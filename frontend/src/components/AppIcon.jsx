export default function AppIcon({ className = "w-6 h-6" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={className}
    >
      <defs>
        {/* Background (deep dark) */}
        <radialGradient id="bgRad" cx="30%" cy="20%" r="90%">
          <stop offset="0" stopColor="#0B1220"></stop>
          <stop offset="0.55" stopColor="#070A10"></stop>
          <stop offset="1" stopColor="#05070C"></stop>
        </radialGradient>

        {/* Brand gradient (indigo -> cyan) */}
        <linearGradient
          id="brand"
          x1="140"
          y1="120"
          x2="420"
          y2="420"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#6366F1"></stop>
          <stop offset="0.45" stopColor="#3B82F6"></stop>
          <stop offset="1" stopColor="#22D3EE"></stop>
        </linearGradient>

        {/* Soft neon glow */}
        <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" result="b"></feGaussianBlur>
          <feColorMatrix
            in="b"
            type="matrix"
            values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 .55 0"
            result="g"
          ></feColorMatrix>
          <feMerge>
            <feMergeNode in="g"></feMergeNode>
            <feMergeNode in="SourceGraphic"></feMergeNode>
          </feMerge>
        </filter>

        {/* Subtle highlight stroke */}
        <linearGradient
          id="stroke"
          x1="80"
          y1="70"
          x2="460"
          y2="470"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#1F2A44" stopOpacity="0.9"></stop>
          <stop offset="0.5" stopColor="#0B1324" stopOpacity="0.2"></stop>
          <stop offset="1" stopColor="#1F2A44" stopOpacity="0.7"></stop>
        </linearGradient>

        {/* Glass sheen */}
        <linearGradient
          id="sheen"
          x1="120"
          y1="90"
          x2="320"
          y2="260"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.10"></stop>
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0"></stop>
        </linearGradient>
      </defs>

      {/* Rounded square */}
      <rect x="48" y="48" width="416" height="416" rx="112" fill="url(#bgRad)"></rect>
      <rect
        x="58"
        y="58"
        width="396"
        height="396"
        rx="104"
        stroke="url(#stroke)"
        strokeWidth="4"
      ></rect>

      {/* Glass sheen */}
      <path
        d="M110 132
           C160 82 250 70 330 92
           C365 102 392 120 410 140
           C330 120 230 125 165 165
           C135 185 120 205 110 230
           Z"
        fill="url(#sheen)"
      ></path>

      {/* Icon mark: stylized S made from two arcs + a sync bolt */}
      {/* Top arc */}
      <path
        d="M332 170
       C332 140 308 116 278 116
       H226
       C196 116 172 140 172 170
       C172 194 189 214 212 220
       L272 236
       C288 240 300 254 300 272
       C300 292 284 308 264 308
       H224
       C204 308 188 292 188 272"
        stroke="#E5E7EB"
        strokeOpacity="0.92"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>

      {/* Bottom arc */}
      <path
        d="M180 342
       C180 372 204 396 234 396
       H286
       C316 396 340 372 340 342
       C340 318 323 298 300 292
       L240 276
       C224 272 212 258 212 240
       C212 220 228 204 248 204
       H288
       C308 204 324 220 324 240"
        stroke="#E5E7EB"
        strokeOpacity="0.92"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>

      {/* Sync bolt (indigo->cyan) */}
      <g filter="url(#softGlow)">
        <path
          d="M292 118
         L246 250
         H300
         L226 394
         L270 266
         H216
         Z"
          fill="url(#brand)"
        ></path>
      </g>

      {/* Tiny spark dot */}
      <circle cx="356" cy="148" r="6" fill="#22D3EE" opacity="0.75"></circle>
    </svg>
  );
}
