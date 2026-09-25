/*
 * Measures one phase of one benchmark case in a fresh process. bench/run.js forks it, sends the config over IPC
 * and gets the result back. The phases need different V8 flags, so each runs in its own process:
 * - time: default V8 settings (plus --expose-gc), so that timings include the GC and JIT work a real build does
 * - alloc: no optimizing compilers and a large young generation, see measureAllocations
 * - profile: CPU and allocation profiles through the inspector
 */
var fs = require('fs');
var path = require('path');
var url = require('url');
var v8 = require('v8');
var perfHooks = require('perf_hooks');
var babel = require('@babel/core');
var cases = require('./cases');
var stats = require('./stats');

var performance = perfHooks.performance;
var root = path.resolve(__dirname, '..');

/*
 * A single read of V8's cumulative allocation counter can be a few hundred KB off, so batches allocate at least this.
 * The plugin's bytes are the difference of two such counts, which for small files is a fraction of either, so the
 * batches are much larger than the read error alone would need: at 64 MB, small cases varied by up to 14%.
 */
var ALLOCATION_BATCH_BYTES = 256 * 1024 * 1024;
var MAX_BATCH_RUNS = 10000;
var ALLOCATION_WARMUP_RUNS = 1;

var BUDGETS = {
  full: {
    warmupMs: 500, warmupRuns: 5, sampleMs: 1500, minSamples: 20, maxSamples: 5000,
    allocationRounds: 3, leakMs: 2000, profileMs: 3000
  },
  quick: {
    warmupMs: 200, warmupRuns: 3, sampleMs: 500, minSamples: 5, maxSamples: 2000,
    allocationRounds: 2, leakMs: 500, profileMs: 1000
  }
};

var hasAllocationCounter = typeof v8.getHeapStatistics().total_allocated_bytes === 'number';

function allocatedBytes() {
  return v8.getHeapStatistics().total_allocated_bytes;
}

// GC entries arrive asynchronously, after the synchronous measurement loops have finished
var gcEntries = [];

new perfHooks.PerformanceObserver(function (list) {
  gcEntries.push.apply(gcEntries, list.getEntries());
}).observe({entryTypes: ['gc']});

function flushGCEntries() {
  return new Promise(function (resolve) {
    setTimeout(resolve, 50);
  });
}

function gcDuring(window, runs) {
  var count = 0;
  var ms = 0;

  for (var i = 0; i < gcEntries.length; i++) {
    var entry = gcEntries[i];

    if (entry.startTime >= window.start && entry.startTime < window.end) {
      count++;
      ms += entry.duration;
    }
  }
  return {perRun: count / runs, msPerRun: ms / runs};
}

/*
 * The measured tasks. A task with a setup gets a fresh input from it on every run; the setup is never timed.
 * Every task reuses one options object, so that Babel's config cache works like in a real build.
 */
function createTasks(fixture, plugin, pluginOptions) {
  var isTSX = /\.tsx$/.test(fixture.filename);
  var parseOptions = {
    babelrc: false,
    configFile: false,
    cwd: root,
    filename: fixture.filename,
    parserOpts: {plugins: isTSX ? ['jsx', 'typescript'] : ['jsx']}
  };
  var e2eOptions = {
    babelrc: false,
    configFile: false,
    cwd: root,
    filename: fixture.filename,
    // Babel switches to compact output above 500 KB, which would make large cases incomparable with small ones
    compact: false,
    presets: isTSX ? [['@babel/preset-typescript', {}]] : [],
    plugins: [[plugin, pluginOptions]]
  };

  function parse() {
    return babel.parseSync(fixture.source, parseOptions);
  }

  // Babel's work on an already parsed AST, without code generation. The AST is mutated, so it cannot be reused.
  function transformFromAst(plugins) {
    var options = {
      babelrc: false,
      configFile: false,
      cwd: root,
      filename: fixture.filename,
      code: false,
      ast: false,
      cloneInputAst: false,
      plugins: plugins
    };

    return function (ast) {
      babel.transformFromAstSync(ast, fixture.source, options);
    };
  }

  return {
    parse: {name: 'parse', run: parse},
    noop: {name: 'noop', setup: parse, run: transformFromAst([])},
    inferno: {name: 'inferno', setup: parse, run: transformFromAst([[plugin, pluginOptions]])},
    e2e: {
      name: 'e2e',
      run: function () {
        babel.transformSync(fixture.source, e2eOptions);
      }
    }
  };
}

function runOnce(task) {
  task.run(task.setup ? task.setup() : undefined);
}

// Runs the tasks in turn for at least minRuns rounds and ms milliseconds, and at most maxRuns rounds
function repeat(taskList, ms, minRuns, maxRuns) {
  var start = performance.now();
  var runs = 0;

  while (runs < maxRuns && (runs < minRuns || performance.now() - start < ms)) {
    for (var i = 0; i < taskList.length; i++) {
      runOnce(taskList[i]);
    }
    runs++;
  }
  return runs;
}

/*
 * Times each task in alternating order (A B, B A, ...), so that drift such as CPU frequency changes affects every
 * task alike. Returns the milliseconds of every recorded run per task, sample i of each task from the same round,
 * and the time window of the recorded runs.
 */
function sampleTimes(taskList, budget) {
  var times = taskList.map(function () {
    return [];
  });
  var round = 0;
  var window = {start: 0, end: 0};

  function rounds(ms, minRounds, record) {
    var start = performance.now();

    for (var r = 0; r < budget.maxSamples && (r < minRounds || performance.now() - start < ms); r++) {
      for (var j = 0; j < taskList.length; j++) {
        var index = round % 2 === 0 ? j : taskList.length - 1 - j;
        var task = taskList[index];
        var input = task.setup ? task.setup() : undefined;
        var t0 = performance.now();

        task.run(input);
        var elapsed = performance.now() - t0;

        if (record) {
          times[index].push(elapsed);
        }
      }
      round++;
    }
  }

  rounds(budget.warmupMs, budget.warmupRuns, false);
  global.gc();
  window.start = performance.now();
  rounds(budget.sampleMs, budget.minSamples, true);
  window.end = performance.now();

  return {times: times, window: window};
}

// Heap growth after repeated runs; module level state that grows with every file would show up here
function leakCheck(task, budget) {
  global.gc();
  global.gc();
  var before = process.memoryUsage().heapUsed;
  var runs = repeat([task], budget.leakMs, 5, 50);

  global.gc();
  global.gc();
  return {runs: runs, retainedBytes: process.memoryUsage().heapUsed - before};
}

function countJSXNodes(ast) {
  var count = 0;

  babel.traverse(ast, {
    JSXElement: function () {
      count++;
    },
    JSXFragment: function () {
      count++;
    }
  });
  return count;
}

function load(config) {
  var fixture = cases.load(config.caseName);
  var tasks = createTasks(fixture, require(config.pluginPath), config.options);

  return {
    budget: config.quick ? BUDGETS.quick : BUDGETS.full,
    fixture: fixture,
    tasks: tasks,
    result: {
      case: fixture.name,
      filename: path.relative(root, fixture.filename),
      sourceBytes: Buffer.byteLength(fixture.source),
      nodes: countJSXNodes(tasks.parse.run())
    }
  };
}

async function measureTime(config) {
  var job = load(config);
  var tasks = job.tasks;
  var result = job.result;

  if (config.mode !== 'isolated') {
    var e2e = sampleTimes([tasks.e2e], job.budget);

    await flushGCEntries();
    result.e2e = {
      time: stats.summarize(e2e.times[0]),
      gc: gcDuring(e2e.window, e2e.times[0].length)
    };
  }

  if (config.mode !== 'e2e') {
    var isolated = sampleTimes([tasks.noop, tasks.inferno], job.budget);
    var noop = isolated.times[0];
    var inferno = isolated.times[1];
    // Differences of runs from the same round; pairing cancels drift that the two medians alone would not
    var paired = inferno.map(function (ms, i) {
      return ms - noop[i];
    });

    result.isolated = {
      noop: {time: stats.summarize(noop)},
      inferno: {time: stats.summarize(inferno)},
      plugin: {time: stats.summarize(paired)}
    };
  }

  result.leak = leakCheck(config.mode !== 'isolated' ? tasks.e2e : tasks.inferno, job.budget);
  return result;
}

/*
 * Bytes allocated per run of each task, including its setup.
 *
 * The count is only repeatable under conditions that need their own process (see ALLOCATION_FLAGS in run.js):
 * - No optimizing compilers (--no-opt --no-maglev). Optimized code allocates less thanks to escape analysis, but
 *   when functions get optimized varies from run to run, and so would the count. Without them the count is what
 *   the code itself allocates, an upper bound of what optimized code allocates.
 * - A young generation of hundreds of MB. V8 counts the objects a scavenge copies as allocated again, so every
 *   scavenge during a batch adds bytes that depend on GC timing rather than on the code.
 * - No forced GC right before a batch; after one, V8 recreates internal state and allocates extra.
 * The remaining errors only add bytes, so the minimum over the rounds is the best estimate.
 */
function measureAllocations(taskList, budget) {
  // Batch size from one run of the last task, which should be the most expensive one
  var a0 = allocatedBytes();

  runOnce(taskList[taskList.length - 1]);
  var estimate = Math.max(allocatedBytes() - a0, 64 * 1024);
  var runs = Math.min(MAX_BATCH_RUNS, Math.max(1, Math.ceil(ALLOCATION_BATCH_BYTES / estimate)));
  var perRun = taskList.map(function () {
    return [];
  });

  for (var r = 0; r < budget.allocationRounds; r++) {
    for (var j = 0; j < taskList.length; j++) {
      var before = allocatedBytes();

      for (var i = 0; i < runs; i++) {
        runOnce(taskList[j]);
      }
      perRun[j].push((allocatedBytes() - before) / runs);
    }
  }

  return {
    batchRuns: runs,
    bytes: perRun.map(function (values) {
      return Math.min.apply(null, values);
    }),
    // How much the rounds differed, as a fraction of the minimum; large values mean the count had not settled
    spread: perRun.map(function (values) {
      var min = Math.min.apply(null, values);

      return (Math.max.apply(null, values) - min) / min;
    })
  };
}

function measureAlloc(config) {
  var job = load(config);
  var tasks = job.tasks;
  var result = job.result;

  if (!hasAllocationCounter) {
    result.allocationCounter = false;
    return result;
  }
  result.allocationCounter = true;

  var measured = config.mode === 'e2e' ? [tasks.e2e] : [tasks.parse, tasks.noop, tasks.inferno];

  if (config.mode === 'all') {
    measured.push(tasks.e2e);
  }
  // Lazy compilation, feedback vectors and Babel's caches allocate on the first runs only
  repeat(measured, 0, ALLOCATION_WARMUP_RUNS, ALLOCATION_WARMUP_RUNS);

  if (config.mode !== 'isolated') {
    var e2e = measureAllocations([tasks.e2e], job.budget);

    result.e2e = {bytes: e2e.bytes[0], spread: e2e.spread[0], batchRuns: e2e.batchRuns};
  }

  if (config.mode !== 'e2e') {
    // Every isolated run parses first, so the parse allocations are measured on their own and subtracted
    var isolated = measureAllocations([tasks.parse, tasks.noop, tasks.inferno], job.budget);
    var parseBytes = isolated.bytes[0];

    result.isolated = {
      parseBytes: parseBytes,
      noop: {bytes: isolated.bytes[1] - parseBytes},
      inferno: {bytes: isolated.bytes[2] - parseBytes},
      plugin: {bytes: isolated.bytes[2] - isolated.bytes[1]},
      spread: Math.max.apply(null, isolated.spread),
      batchRuns: isolated.batchRuns
    };
  }
  return result;
}

function filePath(callFrameUrl) {
  return callFrameUrl.indexOf('file://') === 0 ? url.fileURLToPath(callFrameUrl) : callFrameUrl;
}

function frameLabel(callFrame) {
  var file = callFrame.url ? path.relative(root, filePath(callFrame.url)) : '(native)';

  return (callFrame.functionName || '(anonymous)') + ' ' + file + ':' + (callFrame.lineNumber + 1);
}

// The flat node list of a .cpuprofile as a tree of {callFrame, self (ms), children}
function cpuTree(profile) {
  var nodes = new Map();

  profile.nodes.forEach(function (node) {
    nodes.set(node.id, {callFrame: node.callFrame, self: 0, childIds: node.children || [], children: null});
  });
  for (var i = 0; i < profile.samples.length; i++) {
    nodes.get(profile.samples[i]).self += profile.timeDeltas[i] / 1000;
  }
  nodes.forEach(function (node) {
    node.children = node.childIds.map(function (id) {
      return nodes.get(id);
    });
  });
  return nodes.get(profile.nodes[0].id);
}

// A .heapprofile as a tree of {callFrame, self (bytes), children}
function heapTree(node) {
  return {
    callFrame: node.callFrame,
    self: node.selfSize,
    children: node.children.map(heapTree)
  };
}

/*
 * Sums a profile tree per function.
 * - Plugin functions get their self cost and their inclusive cost; recursive calls are only counted once.
 * - The plugin total is the inclusive cost of every outermost plugin frame, so it includes the Babel code the plugin
 *   calls, like node builders and path.replaceWith.
 * - Callees are the non-plugin functions that run below a plugin frame, by self cost.
 */
function attribute(tree, pluginDir, runs) {
  var prefix = pluginDir + path.sep;
  var labels = new Map();
  var functions = new Map();
  var callees = new Map();
  var onStack = new Map();
  var totals = {all: 0, plugin: 0, transform: 0};

  function labelOf(callFrame) {
    var key = callFrame.url + ':' + callFrame.lineNumber + ':' + callFrame.columnNumber + ':' + callFrame.functionName;
    var label = labels.get(key);

    if (!label) {
      label = {
        name: frameLabel(callFrame),
        plugin: callFrame.url !== '' && filePath(callFrame.url).indexOf(prefix) === 0
      };
      labels.set(key, label);
    }
    return label;
  }

  function entryOf(map, name) {
    var entry = map.get(name);

    if (!entry) {
      entry = {name: name, self: 0, inclusive: 0};
      map.set(name, entry);
    }
    return entry;
  }

  function visit(node, insidePlugin, insideTransform) {
    var label = labelOf(node.callFrame);
    var isTransform = node.callFrame.functionName === 'transformFromAstSync';
    var depth = onStack.get(label.name) || 0;
    var inclusive = node.self;

    onStack.set(label.name, depth + 1);
    for (var i = 0; i < node.children.length; i++) {
      inclusive += visit(node.children[i], insidePlugin || label.plugin, insideTransform || isTransform);
    }
    onStack.set(label.name, depth);

    totals.all += node.self;
    if (label.plugin) {
      var entry = entryOf(functions, label.name);

      entry.self += node.self;
      if (depth === 0) {
        entry.inclusive += inclusive;
      }
      if (!insidePlugin) {
        totals.plugin += inclusive;
      }
    } else if (insidePlugin) {
      entryOf(callees, label.name).self += node.self;
    }
    if (isTransform && !insideTransform) {
      totals.transform += inclusive;
    }
    return inclusive;
  }

  function top(map, field) {
    return Array.from(map.values()).sort(function (a, b) {
      return b[field] - a[field];
    }).slice(0, 12).map(function (entry) {
      return {name: entry.name, self: entry.self / runs, inclusive: entry.inclusive / runs};
    });
  }

  visit(tree, false, false);
  return {
    perRun: {total: totals.all / runs, transform: totals.transform / runs, plugin: totals.plugin / runs},
    functions: top(functions, 'inclusive'),
    callees: top(callees, 'self')
  };
}

async function profile(config) {
  var inspector = require('inspector/promises');
  var job = load(config);
  var task = job.tasks.inferno;
  var session = new inspector.Session();

  // Warm up first, so that the profile shows optimized code rather than the interpreter
  repeat([task], job.budget.warmupMs, job.budget.warmupRuns, Infinity);
  session.connect();

  // One pass per profiler: the allocation sampler slows down allocating code and would skew the CPU profile
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', {interval: 100});
  await session.post('Profiler.start');
  var cpuRuns = repeat([task], job.budget.profileMs, 5, Infinity);
  var cpu = (await session.post('Profiler.stop')).profile;

  await session.post('HeapProfiler.enable');
  await session.post('HeapProfiler.startSampling', {
    samplingInterval: 1024,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true
  });
  var heapRuns = repeat([task], job.budget.profileMs, 5, Infinity);
  var heap = (await session.post('HeapProfiler.stopSampling')).profile;

  session.disconnect();

  var base = path.join(config.profileDir, job.fixture.name.replace(/[^\w-]+/g, '-') + '-' + config.label);

  fs.writeFileSync(base + '.cpuprofile', JSON.stringify(cpu));
  fs.writeFileSync(base + '.heapprofile', JSON.stringify(heap));

  var pluginDir = path.dirname(path.resolve(config.pluginPath));

  return Object.assign(job.result, {
    runs: {cpu: cpuRuns, heap: heapRuns},
    cpu: attribute(cpuTree(cpu), pluginDir, cpuRuns),
    heap: attribute(heapTree(heap.head), pluginDir, heapRuns),
    files: [path.relative(root, base + '.cpuprofile'), path.relative(root, base + '.heapprofile')]
  });
}

var PHASES = {
  time: measureTime,
  alloc: measureAlloc,
  profile: profile
};

process.once('message', function (config) {
  Promise.resolve().then(function () {
    return PHASES[config.phase](config);
  }).then(function (result) {
    process.send({result: result}, function () {
      process.exit(0);
    });
  }, function (error) {
    process.send({error: error && error.stack || String(error)}, function () {
      process.exit(1);
    });
  });
});
