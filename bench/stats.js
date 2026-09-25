function sorted(values) {
  return values.slice().sort(function (a, b) {
    return a - b;
  });
}

// Linear interpolation between the closest ranks, p between 0 and 1
function percentile(values, p) {
  if (values.length === 0) {
    return NaN;
  }
  var s = sorted(values);
  var index = (s.length - 1) * p;
  var lo = Math.floor(index);
  var hi = Math.ceil(index);

  return s[lo] + (s[hi] - s[lo]) * (index - lo);
}

function median(values) {
  return percentile(values, 0.5);
}

// Median absolute deviation, a spread measure that ignores outliers like GC pauses
function mad(values) {
  var m = median(values);

  return median(values.map(function (value) {
    return Math.abs(value - m);
  }));
}

/*
 * Half width of the 95% confidence interval of the median, in the unit of the values.
 * The MAD is scaled to a standard deviation (1.4826), and the standard error of the median is 1.2533 sigma / sqrt(n).
 */
function marginOfMedian(values) {
  if (values.length < 2) {
    return 0;
  }
  return 1.96 * 1.2533 * 1.4826 * mad(values) / Math.sqrt(values.length);
}

// Relative margin of error of the median, as a fraction of the median
function rme(values) {
  var m = median(values);

  return m === 0 ? 0 : marginOfMedian(values) / Math.abs(m);
}

function mean(values) {
  var sum = 0;

  for (var i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

// Geometric mean of the positive values, the usual way to summarize results of differently sized cases
function geomean(values) {
  var positive = values.filter(function (value) {
    return value > 0;
  });

  if (positive.length === 0) {
    return NaN;
  }
  return Math.exp(mean(positive.map(Math.log)));
}

// Summary of timing samples in milliseconds
function summarize(values) {
  return {
    samples: values.length,
    median: median(values),
    margin: marginOfMedian(values),
    rme: rme(values),
    p95: percentile(values, 0.95),
    min: sorted(values)[0],
    max: sorted(values)[values.length - 1]
  };
}

module.exports = {
  percentile: percentile,
  median: median,
  mad: mad,
  marginOfMedian: marginOfMedian,
  rme: rme,
  mean: mean,
  geomean: geomean,
  summarize: summarize
};
