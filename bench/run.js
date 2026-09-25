/*
 * Benchmark of babel-plugin-inferno: time and allocations of the plugin itself, separated from Babel's own work.
 * Every case runs in a fresh worker process (bench/worker.js). See the Benchmarks section of README.md.
 */
var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');
var cases = require('./cases');
var generate = require('./generate');
var stats = require('./stats');

var root = path.resolve(__dirname, '..');
var WORKER = path.join(__dirname, 'worker.js');
var RESULTS_DIR = path.join(__dirname, 'results');
var CACHE_DIR = path.join(__dirname, '.cache');
var CURRENT_PLUGIN = path.join(root, 'lib', 'index.js');
var MB = 1024 * 1024;
// Relative changes below this are reported as no change in compare mode, even when every round agrees
var MIN_SIGNIFICANT_CHANGE = 0.01;
var DEFAULT_PROFILE_CASE = 'mixed-M';
// V8 flags of the worker phases; bench/worker.js explains why allocations need their own
var TIME_FLAGS = ['--expose-gc'];
var ALLOCATION_FLAGS = ['--no-opt', '--no-maglev', '--max-semi-space-size=256', '--min-semi-space-size=256'];

var USAGE = [
  'Usage: node bench/run.js [options]',
  '',
  '  --quick              shorter runs, for a first look',
  '  --filter <regex>     only cases whose name matches (' + generate.large.join(', ') + ' only runs without --quick and\n' +
  '                       --baseline, or when the filter names it)',
  '  --mode <mode>        e2e, isolated or all (default all)',
  '  --options <json>     plugin options (default {})',
  '  --baseline <ref>     compare against a git ref, or a directory containing lib/index.js',
  '  --rounds <n>         rounds in compare mode (default 5, or 3 with --quick)',
  '  --profile            CPU and allocation profiles of the plugin (default case ' + DEFAULT_PROFILE_CASE + ')',
  '  --json <file>        where to write the results (default bench/results/<date>-<sha>.json)',
  '',
  'Cases: ' + cases.names().join(', ')
].join('\n');

function parseArgs(argv) {
  var args = {quick: false, filter: null, mode: 'all', options: {}, baseline: null, rounds: null, profile: false, json: null, help: false};

  for (var i = 0; i < argv.length; i++) {
    var arg = argv[i];
    var value = null;
    var eq = arg.indexOf('=');

    if (eq !== -1) {
      value = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }

    var next = function () {
      if (value !== null) {
        return value;
      }
      if (i + 1 >= argv.length) {
        throw new Error(arg + ' needs a value');
      }
      return argv[++i];
    };

    switch (arg) {
    case '--quick':
      args.quick = true;
      break;
    case '--filter':
      args.filter = new RegExp(next());
      break;
    case '--mode':
      args.mode = next();
      if (['e2e', 'isolated', 'all'].indexOf(args.mode) === -1) {
        throw new Error('--mode must be e2e, isolated or all');
      }
      break;
    case '--options':
      args.options = JSON.parse(next());
      break;
    case '--baseline':
      args.baseline = next();
      break;
    case '--rounds':
      args.rounds = parseInt(next(), 10);
      break;
    case '--profile':
      args.profile = true;
      break;
    case '--json':
      args.json = path.resolve(next());
      break;
    case '--help':
    case '-h':
      args.help = true;
      break;
    default:
      throw new Error('Unknown argument ' + argv[i] + '\n\n' + USAGE);
    }
  }
  return args;
}

function git(gitArgs) {
  return childProcess.execFileSync('git', gitArgs, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
}

function tryGit(gitArgs) {
  try {
    return git(gitArgs);
  } catch {
    return null;
  }
}

function readGovernor() {
  try {
    return fs.readFileSync('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor', 'utf8').trim();
  } catch {
    return null;
  }
}

function environment() {
  var cpus = os.cpus();

  return {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform + ' ' + os.release(),
    arch: process.arch,
    cpu: cpus.length > 0 ? cpus[0].model : null,
    cores: cpus.length,
    governor: readGovernor(),
    sha: tryGit(['rev-parse', '--short', 'HEAD']),
    // Only uncommitted changes to the plugin make results differ from the commit's
    dirty: tryGit(['status', '--porcelain', '--', 'lib']) !== '',
    generatorVersion: generate.GENERATOR_VERSION
  };
}

// Babel prints deprecation warnings once per process, so every worker prints them again; they are shown once at the end
var warnings = new Map();

function collectWarnings(text) {
  var blocks = [];

  text.split('\n').forEach(function (line) {
    if (line.trim() === '') {
      return;
    }
    if (/^\s/.test(line) && blocks.length > 0) {
      blocks[blocks.length - 1] += '\n' + line;
    } else {
      blocks.push(line);
    }
  });
  blocks.forEach(function (block) {
    warnings.set(block, (warnings.get(block) || 0) + 1);
  });
}

function printWarnings() {
  if (warnings.size === 0) {
    return;
  }
  console.log('\nWorker stderr, ' + warnings.size + ' distinct messages:');
  warnings.forEach(function (count, block) {
    console.log('  [' + count + 'x] ' + block.split('\n').join('\n  '));
  });
}

function runWorker(config, flags) {
  return new Promise(function (resolve, reject) {
    var child = childProcess.fork(WORKER, [], {
      cwd: root,
      execArgv: flags,
      stdio: ['ignore', 'inherit', 'pipe', 'ipc']
    });
    var stderr = '';
    var reply = null;

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', function (chunk) {
      stderr += chunk;
    });
    child.on('message', function (message) {
      reply = message;
    });
    child.on('error', reject);
    child.on('exit', function (code) {
      if (reply && reply.result) {
        collectWarnings(stderr);
        resolve(reply.result);
      } else {
        reject(new Error(config.phase + ' worker for ' + config.caseName + ' failed' +
          (reply && reply.error ? ':\n' + reply.error : ' with exit code ' + code + ':\n' + stderr)));
      }
    });
    child.send(config);
  });
}

function formatNumber(value, digits) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'n/a';
  }
  return value.toFixed(digits);
}

function ms(value) {
  return formatNumber(value, value !== null && Math.abs(value) < 10 ? 3 : 1);
}

function mb(bytes) {
  if (typeof bytes !== 'number') {
    return 'n/a';
  }
  return formatNumber(bytes / MB, Math.abs(bytes) < 10 * MB ? 3 : 1);
}

function percent(fraction) {
  if (typeof fraction !== 'number' || isNaN(fraction)) {
    return 'n/a';
  }
  return formatNumber(fraction * 100, 1) + '%';
}

function signedPercent(fraction) {
  return (fraction > 0 ? '+' : '') + percent(fraction);
}

// Prints rows of cells as columns; the first column is left aligned, the others right aligned
function table(rows) {
  var widths = [];

  rows.forEach(function (row) {
    row.forEach(function (cell, i) {
      widths[i] = Math.max(widths[i] || 0, String(cell).length);
    });
  });
  rows.forEach(function (row) {
    console.log(row.map(function (cell, i) {
      return i === 0 ? String(cell).padEnd(widths[i]) : String(cell).padStart(widths[i]);
    }).join('  ').trimEnd());
  });
}

function printEnvironment(env, args) {
  console.log('babel-plugin-inferno benchmark');
  console.log('  node ' + env.node + ', ' + env.cpu + ' (' + env.cores + ' cores), governor ' + (env.governor || 'unknown'));
  console.log('  commit ' + (env.sha || 'unknown') + (env.dirty ? ' with uncommitted changes in lib/' : '') +
    ', plugin options ' + JSON.stringify(args.options) + (args.quick ? ', quick' : ''));
  if (env.governor && env.governor !== 'performance') {
    console.log('  note: CPU governor is ' + env.governor + '; timings are noisier than with "performance"');
  }
  console.log('');
}

var RESULT_HEADER = [
  'case', 'nodes', 'e2e ms', '±', 'e2e MB', 'gc/op',
  'plugin ms', '±', 'plugin MB', 'µs/node', 'KB/node', 'share', 'leak'
];

function resultRow(result) {
  var e2e = result.e2e;
  var plugin = result.isolated && result.isolated.plugin;

  return [
    result.case,
    result.nodes,
    e2e ? ms(e2e.time.median) : '-',
    e2e ? percent(e2e.time.rme) : '-',
    e2e ? mb(e2e.bytes) : '-',
    e2e ? formatNumber(e2e.gc.perRun, 2) : '-',
    plugin ? ms(plugin.time.median) : '-',
    plugin ? percent(plugin.time.rme) : '-',
    plugin ? mb(plugin.bytes) : '-',
    plugin ? formatNumber(plugin.time.median * 1000 / result.nodes, 2) : '-',
    plugin ? formatNumber(plugin.bytes / 1024 / result.nodes, 2) : '-',
    plugin && e2e ? percent(plugin.time.median / e2e.time.median) : '-',
    result.leak.retainedBytes > MB ? '+' + mb(result.leak.retainedBytes) + ' MB' : 'ok'
  ];
}

function geomeanOf(results, get) {
  return stats.geomean(results.map(get).filter(function (value) {
    return value !== null && value !== undefined;
  }));
}

function summary(results) {
  return {
    cases: results.length,
    pluginMs: geomeanOf(results, function (r) {
      return r.isolated && r.isolated.plugin.time.median;
    }),
    pluginBytes: geomeanOf(results, function (r) {
      return r.isolated && r.isolated.plugin.bytes;
    }),
    e2eMs: geomeanOf(results, function (r) {
      return r.e2e && r.e2e.time.median;
    }),
    e2eBytes: geomeanOf(results, function (r) {
      return r.e2e && r.e2e.bytes;
    })
  };
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('\nResults written to ' + path.relative(process.cwd(), file));
}

function defaultJsonPath(env, suffix) {
  var stamp = env.date.replace(/[:.]/g, '-').replace(/-\d+Z$/, '');

  return path.join(RESULTS_DIR, stamp + '-' + (env.sha || 'nogit') + (env.dirty ? '-dirty' : '') + (suffix || '') + '.json');
}

function baseConfig(args, pluginPath, caseName) {
  return {pluginPath: pluginPath, caseName: caseName, mode: args.mode, options: args.options, quick: args.quick};
}

// Copies the keys of source that target does not have, recursing into objects both have
function mergeInto(target, source) {
  Object.keys(source).forEach(function (key) {
    var value = source[key];

    if (value && typeof value === 'object' && target[key] && typeof target[key] === 'object') {
      mergeInto(target[key], value);
    } else if (!(key in target)) {
      target[key] = value;
    }
  });
  return target;
}

function runTime(config) {
  return runWorker(Object.assign({}, config, {phase: 'time'}), TIME_FLAGS);
}

function runAlloc(config) {
  return runWorker(Object.assign({}, config, {phase: 'alloc'}), ALLOCATION_FLAGS);
}

// Both phases of one case, as one result
async function measureCase(config) {
  var time = await runTime(config);

  return mergeInto(time, await runAlloc(config));
}

async function bench(names, args, env) {
  var results = [];

  process.stdout.write('running:');
  for (var i = 0; i < names.length; i++) {
    results.push(await measureCase(baseConfig(args, CURRENT_PLUGIN, names[i])));
    process.stdout.write(' ' + names[i]);
  }
  process.stdout.write('\n\n');
  table([RESULT_HEADER].concat(results.map(resultRow)));

  var total = summary(results);

  console.log('\ngeomean of ' + total.cases + ' cases: plugin ' + ms(total.pluginMs) + ' ms, ' + mb(total.pluginBytes) +
    ' MB; e2e ' + ms(total.e2eMs) + ' ms, ' + mb(total.e2eBytes) + ' MB');
  console.log('plugin = isolated transform with the plugin minus the same without it; share = plugin ms / e2e ms');
  console.log('MB = allocated per run, counted with V8\'s optimizing compilers off: repeatable, and an upper bound');
  printWarnings();
  writeJson(args.json || defaultJsonPath(env), {environment: env, args: jsonArgs(args), summary: total, results: results});
}

function jsonArgs(args) {
  return Object.assign({}, args, {filter: args.filter ? args.filter.source : null});
}

// A git ref is extracted to bench/.cache/<sha>/lib, where require() still finds the repository's node_modules
function resolveBaseline(ref) {
  if (fs.existsSync(ref) && fs.statSync(ref).isDirectory()) {
    var dir = path.resolve(ref);
    var candidates = [path.join(dir, 'lib', 'index.js'), path.join(dir, 'index.js')];
    var pluginPath = candidates.filter(function (file) {
      return fs.existsSync(file);
    })[0];

    if (!pluginPath) {
      throw new Error('No lib/index.js or index.js in ' + ref);
    }
    return {label: path.relative(root, dir) || '.', id: path.basename(dir), pluginPath: pluginPath};
  }

  var sha = tryGit(['rev-parse', '--verify', ref + '^{commit}']);

  if (!sha) {
    throw new Error(ref + ' is neither a directory nor a git revision');
  }
  var target = path.join(CACHE_DIR, sha);
  var entry = path.join(target, 'lib', 'index.js');

  if (!fs.existsSync(entry)) {
    fs.mkdirSync(target, {recursive: true});
    childProcess.execFileSync('tar', ['-x', '-C', target], {
      input: childProcess.execFileSync('git', ['archive', sha, 'lib'], {cwd: root, maxBuffer: 64 * MB})
    });
  }
  return {label: ref + ' (' + sha.slice(0, 7) + ')', id: sha.slice(0, 7), pluginPath: entry};
}

var COMPARED_METRICS = [
  {
    name: 'plugin ms',
    phase: 'time',
    format: ms,
    get: function (r) {
      return r.isolated && r.isolated.plugin.time.median;
    }
  },
  {
    name: 'plugin MB',
    phase: 'alloc',
    format: mb,
    get: function (r) {
      return r.isolated && r.isolated.plugin.bytes;
    }
  },
  {
    name: 'e2e ms',
    phase: 'time',
    format: ms,
    get: function (r) {
      return r.e2e && r.e2e.time.median;
    }
  },
  {
    name: 'e2e MB',
    phase: 'alloc',
    format: mb,
    get: function (r) {
      return r.e2e && r.e2e.bytes;
    }
  }
];

/*
 * The change of a metric: the median over rounds of current / baseline - 1, where both ran in the same round.
 * It counts as a change only when every round agrees on the direction, and the median change is at least 1% and
 * larger than the margin of error of the median.
 */
function change(metric, current, baseline) {
  var deltas = [];

  for (var i = 0; i < current.length; i++) {
    var a = metric.get(current[i]);
    var b = metric.get(baseline[i]);

    if (a !== null && a !== undefined && b !== null && b !== undefined && b > 0) {
      deltas.push(a / b - 1);
    }
  }
  if (deltas.length === 0) {
    return null;
  }
  var median = stats.median(deltas);
  var min = Math.min.apply(null, deltas);
  var max = Math.max.apply(null, deltas);

  return {
    current: stats.median(current.map(metric.get)),
    baseline: stats.median(baseline.map(metric.get)),
    delta: median,
    min: min,
    max: max,
    significant: (min > 0 || max < 0) && Math.abs(median) >= MIN_SIGNIFICANT_CHANGE &&
      Math.abs(median) > stats.marginOfMedian(deltas)
  };
}

async function compare(names, args, env) {
  var baseline = resolveBaseline(args.baseline);
  var rounds = args.rounds || (args.quick ? 3 : 5);
  var versions = [
    {key: 'current', label: 'working tree', pluginPath: CURRENT_PLUGIN},
    {key: 'baseline', label: baseline.label, pluginPath: baseline.pluginPath}
  ];
  var raw = {};

  console.log('Comparing the working tree with ' + baseline.label + ', ' + rounds + ' rounds of ' + names.length + ' cases\n');
  names.forEach(function (name) {
    raw[name] = {current: {time: [], alloc: []}, baseline: {time: [], alloc: []}};
  });

  for (var round = 0; round < rounds; round++) {
    process.stdout.write('round ' + (round + 1) + '/' + rounds + ':');
    for (var i = 0; i < names.length; i++) {
      // Alternate which version goes first, so that neither always runs on a warmer or cooler machine
      var order = (round + i) % 2 === 0 ? versions : versions.slice().reverse();

      for (var j = 0; j < order.length; j++) {
        // The rounds repeat the measurements, so each worker gets the quick budget
        var config = Object.assign(baseConfig(args, order[j].pluginPath, names[i]), {quick: true});
        var runs = raw[names[i]][order[j].key];

        runs.time.push(await runTime(config));
        // Allocation counts repeat to about 1%, so two rounds are enough to see that they agree
        if (round < 2) {
          runs.alloc.push(await runAlloc(config));
        }
      }
      process.stdout.write(' ' + names[i]);
    }
    process.stdout.write('\n');
  }

  var rows = [['case', 'metric', 'baseline', 'current', 'change', 'range']];
  var changes = {};

  names.forEach(function (name) {
    changes[name] = {};
    COMPARED_METRICS.forEach(function (metric, index) {
      var c = change(metric, raw[name].current[metric.phase], raw[name].baseline[metric.phase]);

      changes[name][metric.name] = c;
      if (c === null) {
        return;
      }
      rows.push([
        index === 0 ? name : '',
        metric.name,
        metric.format(c.baseline),
        metric.format(c.current),
        (c.significant ? '' : '~') + signedPercent(c.delta),
        signedPercent(c.min) + ' .. ' + signedPercent(c.max)
      ]);
    });
  });

  console.log('');
  table(rows);

  // Geometric mean of the per case ratios, the headline number of the comparison
  var headline = COMPARED_METRICS.map(function (metric) {
    var ratios = names.map(function (name) {
      var c = changes[name][metric.name];

      return c ? 1 + c.delta : null;
    }).filter(function (ratio) {
      return ratio !== null;
    });

    return ratios.length > 0 ? metric.name + ' ' + signedPercent(stats.geomean(ratios) - 1) : null;
  }).filter(Boolean);

  console.log('\ngeomean change over ' + names.length + ' cases: ' + headline.join(', '));
  console.log('change = median over rounds of current/baseline - 1; "~" = rounds disagree on the direction or |change| < ' +
    percent(MIN_SIGNIFICANT_CHANGE));
  printWarnings();
  writeJson(args.json || defaultJsonPath(env, '-vs-' + baseline.id), {
    environment: env,
    args: jsonArgs(args),
    baseline: baseline,
    rounds: rounds,
    changes: changes,
    raw: raw
  });
}

function printAttribution(title, unit, attribution, format) {
  var perRun = attribution.perRun;
  var share = perRun.transform > 0 ? ' = ' + percent(perRun.plugin / perRun.transform) + ' of transformFromAstSync' : '';

  console.log('  ' + title + ': plugin ' + format(perRun.plugin) + ' ' + unit + '/op' + share);

  var rows = [['    plugin function', 'incl ' + unit, 'self ' + unit]].concat(attribution.functions.map(function (entry) {
    return ['    ' + entry.name, format(entry.inclusive), format(entry.self)];
  }));

  table(rows);
  console.log('');
  table([['    called from plugin code', 'self ' + unit]].concat(attribution.callees.map(function (entry) {
    return ['    ' + entry.name, format(entry.self)];
  })));
  console.log('');
}

async function profile(names, args, env) {
  var results = [];

  fs.mkdirSync(RESULTS_DIR, {recursive: true});
  for (var i = 0; i < names.length; i++) {
    var result = await runWorker(Object.assign(baseConfig(args, CURRENT_PLUGIN, names[i]), {
      phase: 'profile',
      profileDir: RESULTS_DIR,
      label: (env.sha || 'nogit') + (env.dirty ? '-dirty' : '')
    }), TIME_FLAGS);

    results.push(result);
    console.log(result.case + ' (' + result.nodes + ' JSX nodes, isolated transform, ' + result.runs.cpu + ' runs for time and ' +
      result.runs.heap + ' for allocations)');
    printAttribution('time', 'ms', result.cpu, ms);
    printAttribution('allocations', 'MB', result.heap, function (bytes) {
      return mb(bytes);
    });
    console.log('  profiles: ' + result.files.join(', ') + ' (open in Chrome DevTools or https://www.speedscope.app)\n');
  }
  console.log('Profiling slows the code down; use the numbers for proportions, and bench for absolute times.');
  printWarnings();
}

function selectCases(args) {
  var all = cases.names();

  if (!args.filter) {
    if (args.profile) {
      return [DEFAULT_PROFILE_CASE];
    }
    if (args.quick || args.baseline) {
      console.log('Skipping ' + generate.large.join(', ') + ' in quick and compare runs; use --filter to include it\n');
      return all.filter(function (name) {
        return generate.large.indexOf(name) === -1;
      });
    }
    return all;
  }
  return all.filter(function (name) {
    return args.filter.test(name);
  });
}

async function main() {
  var args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return;
  }

  var names = selectCases(args);

  if (names.length === 0) {
    throw new Error('No case matches ' + args.filter + '. Cases: ' + cases.names().join(', '));
  }

  var env = environment();

  printEnvironment(env, args);
  if (args.profile) {
    await profile(names, args, env);
  } else if (args.baseline) {
    await compare(names, args, env);
  } else {
    await bench(names, args, env);
  }
}

main().catch(function (error) {
  console.error(error.message || error);
  process.exitCode = 1;
});
