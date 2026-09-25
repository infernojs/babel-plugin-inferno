// An icon set in the style of Feather/Lucide, the kind of SVG-heavy module many apps ship
function Svg({size = 24, color = 'currentColor', strokeWidth = 2, children, ...rest}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function Activity(props) {
  return <Svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Svg>;
}

export function AlertTriangle(props) {
  return (
    <Svg {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  );
}

export function Camera(props) {
  return (
    <Svg {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

export function Clock(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

export function Github(props) {
  return (
    <Svg {...props}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </Svg>
  );
}

export function Layers(props) {
  return (
    <Svg {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </Svg>
  );
}

export function Loader({spin, ...props}) {
  return (
    <Svg className={spin ? 'spin' : null} {...props}>
      <line x1="12" y1="2" x2="12" y2="6" strokeOpacity={1} />
      <line x1="12" y1="18" x2="12" y2="22" strokeOpacity={0.5} />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" strokeOpacity={0.875} />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" strokeOpacity={0.375} />
      <line x1="2" y1="12" x2="6" y2="12" strokeOpacity={0.75} />
      <line x1="18" y1="12" x2="22" y2="12" strokeOpacity={0.25} />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" strokeOpacity={0.625} />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" strokeOpacity={0.125} />
    </Svg>
  );
}

export function Logo({title}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 120 32" role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#ff6b6b" stopOpacity={1} />
          <stop offset="100%" stopColor="#f06595" stopOpacity={0.9} />
        </linearGradient>
        <clipPath id="logo-clip" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width="32" height="32" rx="6" />
        </clipPath>
        <filter id="logo-shadow" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
          <feOffset dx="0" dy="1" result="offset" />
          <feFlood floodColor="#000" floodOpacity={0.25} />
          <feComposite in2="offset" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <symbol id="logo-flame" viewBox="0 0 24 24">
          <path d="M12 2c1 4-3 6-3 10a3 3 0 0 0 6 0c0-2-1-3-1-5 3 2 5 5 5 8a7 7 0 0 1-14 0c0-6 7-8 7-13z" />
        </symbol>
      </defs>
      <g clipPath="url(#logo-clip)" filter="url(#logo-shadow)">
        <rect width="32" height="32" fill="url(#logo-gradient)" />
        <use xlinkHref="#logo-flame" x="4" y="4" width="24" height="24" fill="#fff" />
      </g>
      <text
        x="40"
        y="22"
        fontFamily="Inter, sans-serif"
        fontSize={18}
        fontWeight={700}
        letterSpacing="-0.02em"
        textAnchor="start"
        dominantBaseline="middle"
        fill="currentColor"
      >
        inferno
      </text>
    </svg>
  );
}

export function PieChart({slices, radius = 40}) {
  var angle = 0;

  return (
    <svg viewBox="-50 -50 100 100" width={radius * 2} height={radius * 2} shapeRendering="geometricPrecision">
      <g transform="rotate(-90)" fillRule="evenodd" clipRule="evenodd">
        {slices.map(function (slice) {
          var start = angle;

          angle += slice.value * Math.PI * 2;
          var large = angle - start > Math.PI ? 1 : 0;
          var d = 'M0 0 L' + Math.cos(start) * radius + ' ' + Math.sin(start) * radius +
            ' A' + radius + ' ' + radius + ' 0 ' + large + ' 1 ' + Math.cos(angle) * radius + ' ' + Math.sin(angle) * radius + ' Z';

          return <path key={slice.id} d={d} fill={slice.color} stroke="#fff" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />;
        })}
      </g>
      <circle r={radius * 0.55} fill="#fff" pointerEvents="none" />
      <text textAnchor="middle" dominantBaseline="central" fontSize={10} fillOpacity={0.8}>
        {slices.length} parts
      </text>
    </svg>
  );
}

export function Sparkline({points, width = 120, height = 24}) {
  var max = Math.max.apply(null, points);
  var path = points.map(function (value, i) {
    return (i === 0 ? 'M' : 'L') + (i * width / (points.length - 1)) + ' ' + (height - value / max * height);
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} preserveAspectRatio="none">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="none" markerEnd="url(#dot)" />
      <marker id="dot" markerWidth={4} markerHeight={4} refX={2} refY={2}>
        <circle cx="2" cy="2" r="2" fill="currentColor" />
      </marker>
    </svg>
  );
}
