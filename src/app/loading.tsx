export default function Loading() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.route-morph{width:120px;height:120px;position:relative;animation:njd-bounce-cycle 4s ease-in-out infinite}
.route-morph .logo-img,.route-morph .car-svg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transition:opacity 0.25s ease}
.route-morph .logo-img .njd-text{font-family:'Arial Black','Helvetica Neue',sans-serif;font-size:42px;font-weight:900;letter-spacing:6px;color:var(--njd-loader-icon);user-select:none}
.route-morph .car-svg svg{width:100px;height:auto}
.route-morph .car-svg svg path,.route-morph .car-svg svg circle,.route-morph .car-svg svg line,.route-morph .car-svg svg rect{stroke:var(--njd-loader-icon);fill:none}
.route-morph .logo-img{animation:njd-logo-vis 4s ease-in-out infinite}
.route-morph .car-svg{animation:njd-car-vis 4s ease-in-out infinite}
.route-bounce-shadow{width:60px;height:8px;border-radius:50%;background:var(--njd-loader-shadow);animation:njd-shadow-cycle 4s ease-in-out infinite}
`,
        }}
      />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <div className="route-morph">
            <div className="logo-img">
              <span className="njd-text">NJD</span>
            </div>
            <div className="car-svg">
              <svg
                viewBox="0 0 120 70"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20,42 L25,42 L30,28 L52,26 L62,18 L88,18 L96,28 L100,42 L105,42" />
                <path d="M52,26 L55,18" />
                <path d="M30,28 L25,28" />
                <path d="M60,18 L58,12 L68,12 L66,18" />
                <line x1="35" y1="42" x2="82" y2="42" />
                <circle cx="30" cy="46" r="9" strokeWidth="2.5" />
                <circle cx="30" cy="46" r="3.5" strokeWidth="1.5" />
                <circle cx="90" cy="46" r="9" strokeWidth="2.5" />
                <circle cx="90" cy="46" r="3.5" strokeWidth="1.5" />
                <path d="M55,18 L58,26 L78,26 L88,18 Z" strokeWidth="2" />
                <line x1="65" y1="32" x2="72" y2="32" strokeWidth="1.8" />
                <path d="M12,44 Q16,42 20,44" strokeWidth="1.5" opacity="0.5" />
                <path d="M6,42 Q10,40 14,42" strokeWidth="1.2" opacity="0.3" />
              </svg>
            </div>
          </div>
          <div className="route-bounce-shadow" />
        </div>
      </div>
    </>
  );
}
