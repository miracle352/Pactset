"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function PlaceholderLink({ className, label, children }: { className?: string; label?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/useValidAnchor: The supplied footer specification explicitly requires inert placeholder links that prevent navigation.
    <a className={className} href="#velora-footer" onClick={(event) => event.preventDefault()} aria-label={label}>{children}</a>
  );
}

export default function ArchitecturalLanding() {
  const footerRef = useRef<HTMLElement>(null);
  const year = new Date().getFullYear();
  const scrollToFooter = () => footerRef.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });

  return (
    <main className="velora-page" id="page-top">
      <section className="velora-hero" aria-labelledby="velora-title">
        <div className="velora-hero-image" aria-hidden="true" />
        <div className="velora-hero-overlay" aria-hidden="true" />
        <div className="velora-grain" aria-hidden="true" />
        <svg className="velora-hero-lines" viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path className="velora-line" d="M970 -30 L1240 390 L1440 120" /><path className="velora-line" d="M1050 -40 L1420 545" /><path className="velora-line" d="M720 760 L1045 290 L1380 760" />
          <path className="velora-signal" d="M970 -30 L1240 390 L1440 120" /><path className="velora-signal signal-late" d="M720 760 L1045 290 L1380 760" />
        </svg>
        <div className="velora-hero-content">
          <p className="velora-eyebrow"><span aria-hidden="true" />DIGITAL CREATIVE PLATFORM</p>
          <h1 id="velora-title">Build ideas people <em>remember.</em></h1>
          <div className="velora-hero-bottom">
            <p>Explore expressive interfaces, interactive components and polished digital experiences created for the next generation of builders.</p>
            <button className="velora-explore" type="button" onClick={scrollToFooter} aria-label="Explore the footer">
              <span>EXPLORE FOOTER</span><span className="velora-explore-circle" aria-hidden="true"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5h10v10M15 5 5 15" /></svg></span>
            </button>
          </div>
        </div>
      </section>

      <footer className="velora-footer" id="velora-footer" ref={footerRef}>
        <svg className="velora-footer-lines" viewBox="0 0 850 515" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path className="footer-line" d="M165 -45 L445 405 L650 -25" /><path className="footer-line" d="M390 515 L615 155 L850 485" /><path className="footer-line" d="M285 515 L585 382 L780 515" /><path className="footer-line" d="M505 -35 L850 515" />
          <path className="footer-signal" d="M165 -45 L445 405 L650 -25" /><path className="footer-signal signal-two" d="M390 515 L615 155 L850 485" /><path className="footer-signal signal-three" d="M285 515 L585 382 L780 515" />
        </svg>
        <div className="velora-footer-grid">
          <section className="velora-brand" aria-labelledby="velora-brand-name">
            <div className="velora-wordmark">
              <svg className="velora-logo" viewBox="0 0 44 42" aria-hidden="true"><path d="M4 37 L22 5 L40 37 Z" /><path d="M10 37 L22 15 L34 37" /><path d="M15 31 L28 37 L22 25 Z" /></svg>
              <strong id="velora-brand-name">VELORA</strong>
            </div>
            <p className="velora-brand-copy">Helping modern creators transform unfinished ideas into thoughtful, expressive and unforgettable digital experiences.</p>
            <nav className="velora-socials" aria-label="Social links">
              <PlaceholderLink label="Velora on X"><span className="social-ring" aria-hidden="true" /><span className="velora-x">𝕏</span></PlaceholderLink>
              <PlaceholderLink label="Velora on LinkedIn"><span className="social-ring" aria-hidden="true" /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.2V18M6.5 5.3v.1M10.5 18v-5.5c0-2.2 1.4-3.7 3.5-3.7 2 0 3.5 1.4 3.5 4.1V18M10.5 9.1V18" /></svg></PlaceholderLink>
              <PlaceholderLink label="Velora on Instagram"><span className="social-ring" aria-hidden="true" /><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3.5" /><path d="M17.5 6.8h.01" /></svg></PlaceholderLink>
              <PlaceholderLink label="Velora on Facebook"><span className="social-ring" aria-hidden="true" /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 20v-7h2.6l.4-3h-3V8.1c0-.9.3-1.6 1.7-1.6h1.6V3.8c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4.1V10H9v3h2.6v7" /></svg></PlaceholderLink>
            </nav>
            <button className="velora-top" type="button" onClick={scrollToTop} aria-label="Back to the top of the page"><span className="top-fill" aria-hidden="true" /><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4M5.5 8.5 10 4l4.5 4.5" /></svg><span>BACK TO TOP</span></button>
          </section>
          <nav className="velora-menu" aria-label="Site map"><h2>Site Map</h2><div>{["Discover","Component library","Motion collection","Creator stories","About the studio","Get in touch"].map((label,index)=><PlaceholderLink key={label} className={index === 0 ? "is-active" : ""}>{label}</PlaceholderLink>)}</div></nav>
          <nav className="velora-menu" aria-label="Legal"><h2>Legal</h2><div>{["Privacy policy","Terms of use","Creator guidelines"].map((label)=><PlaceholderLink key={label}>{label}</PlaceholderLink>)}</div></nav>
        </div>
        <div className="velora-copyright">Copyright © {year} Velora Studio. All rights reserved.</div>
      </footer>
      <style>{`
        .velora-page{--v-bg:#061f1e;--v-green:#103f3c;--v-gold:#dfa12d;--v-white:#f3f5ef;width:100%;min-width:320px;min-height:100dvh;overflow:clip;color:var(--v-white);background:var(--v-bg);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5;isolation:isolate}.velora-page *,.velora-page *::before,.velora-page *::after{box-sizing:border-box}
        .velora-hero{position:relative;min-height:clamp(480px,68svh,740px);padding:70px clamp(24px,7vw,110px) 110px;display:flex;align-items:flex-end;overflow:hidden;isolation:isolate;background:var(--v-bg)}
        .velora-hero-image{position:absolute;inset:0;z-index:-5;background:url("https://plus.unsplash.com/premium_photo-1665426465884-d2361b53a866?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8dmVjdG9yJTIwYXJ0fGVufDB8fDB8fHww") center 42%/cover no-repeat;transform:scale(1.015)}
        .velora-hero-overlay{position:absolute;inset:0;z-index:-4;background:radial-gradient(circle at 73% 27%,rgba(223,161,45,.23),transparent 22%),linear-gradient(90deg,rgba(2,22,21,.84),rgba(3,25,24,.52) 45%,rgba(3,22,22,.2) 75%,rgba(3,18,18,.4)),linear-gradient(180deg,rgba(3,24,23,.15),rgba(4,29,28,.35) 48%,rgba(5,31,30,.98))}
        .velora-grain{position:absolute;inset:0;z-index:-3;opacity:.065;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.92' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.72'/%3E%3C/svg%3E");mix-blend-mode:soft-light}
        .velora-hero-lines{position:absolute;inset:0;z-index:-2;width:100%;height:100%;pointer-events:none}.velora-line{fill:none;stroke:rgba(209,231,224,.18);stroke-width:1;vector-effect:non-scaling-stroke}.velora-signal{fill:none;stroke:rgba(223,161,45,.85);stroke-width:1.2;stroke-linecap:round;stroke-dasharray:3 95;vector-effect:non-scaling-stroke;animation:veloraTravel 8s linear infinite}.signal-late{animation-delay:-4s}
        .velora-hero-content{position:relative;z-index:2;width:min(100%,970px)}.velora-eyebrow{margin:0 0 24px;display:flex;align-items:center;gap:13px;color:rgba(243,245,239,.78);font-size:12px;font-weight:700;letter-spacing:.2em;line-height:1.2}.velora-eyebrow span{width:45px;height:1px;flex:0 0 auto;background:var(--v-gold)}
        .velora-hero h1{max-width:970px;margin:0;color:var(--v-white);font-size:clamp(55px,8vw,118px);font-weight:500;letter-spacing:-.065em;line-height:.92;text-wrap:balance}.velora-hero h1 em{color:var(--v-gold);font-family:Georgia,"Times New Roman",serif;font-style:italic;font-weight:400;letter-spacing:-.055em}
        .velora-hero-bottom{width:min(100%,850px);margin-top:38px;display:flex;align-items:flex-end;justify-content:space-between;gap:45px}.velora-hero-bottom>p{max-width:570px;margin:0;color:rgba(243,245,239,.75);font-size:clamp(15px,1.22vw,19px);line-height:1.65}
        .velora-explore{flex:0 0 auto;display:inline-flex;align-items:center;gap:12px;padding:0;border:0;color:var(--v-white);background:transparent;cursor:pointer;font-size:12px;font-weight:750;letter-spacing:.14em}.velora-explore-circle{width:45px;height:45px;display:grid;place-items:center;border:1px solid rgba(243,245,239,.58);border-radius:50%;transition:transform 300ms ease,background-color 300ms ease,border-color 300ms ease,color 300ms ease}.velora-explore-circle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.velora-explore:hover .velora-explore-circle{transform:translate(4px,4px);color:var(--v-bg);border-color:var(--v-gold);background:var(--v-gold)}
        .velora-explore:focus-visible,.velora-top:focus-visible,.velora-socials a:focus-visible,.velora-menu a:focus-visible{outline:3px solid var(--v-gold);outline-offset:5px}
        .velora-footer{position:relative;z-index:5;width:calc(100% - 24px);min-height:545px;margin:-32px 12px 12px;overflow:hidden;border-radius:27px;background:radial-gradient(circle at 77% 48%,rgba(95,142,134,.14),transparent 31%),var(--v-green);box-shadow:0 -28px 90px rgba(0,0,0,.23)}
        .velora-footer-grid{position:relative;z-index:2;min-height:515px;display:grid;grid-template-columns:minmax(365px,1.45fr) .5fr .58fr;gap:clamp(55px,8vw,150px);padding:clamp(62px,6vw,88px) clamp(38px,7.6vw,108px) 62px}.velora-footer-lines{position:absolute;z-index:1;top:0;right:0;width:61%;height:calc(100% - 30px);pointer-events:none}.footer-line{fill:none;stroke:rgba(200,228,220,.17);stroke-width:1.25;vector-effect:non-scaling-stroke}.footer-signal{fill:none;stroke:rgba(223,161,45,.76);stroke-width:1.35;stroke-linecap:round;stroke-dasharray:3 128;vector-effect:non-scaling-stroke;animation:veloraFooterTravel 11s linear infinite}.signal-two{animation-delay:-3.7s}.signal-three{animation-delay:-7.2s}
        .velora-wordmark{display:flex;align-items:center;gap:14px}.velora-logo{width:39px;height:39px;overflow:visible}.velora-logo path{fill:none;stroke:var(--v-gold);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;animation:veloraFloat 4.5s ease-in-out infinite}.velora-logo path:nth-child(2){animation-delay:-1.5s}.velora-logo path:nth-child(3){animation-delay:-3s}.velora-wordmark strong{color:var(--v-white);font-size:clamp(24px,2vw,29px);font-weight:680;letter-spacing:.04em}
        .velora-brand-copy{max-width:435px;margin:48px 0 0;color:rgba(243,245,239,.9);font-size:clamp(16px,1.35vw,20px);line-height:1.62}.velora-socials{margin-top:42px;display:flex;align-items:center;gap:27px}.velora-socials a{position:relative;width:29px;height:29px;display:grid;place-items:center;color:var(--v-white);transition:transform 250ms ease,color 250ms ease}.velora-socials svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.velora-socials a:last-child svg{fill:currentColor;stroke:none}.velora-x{font-size:18px;line-height:1}.social-ring{position:absolute;inset:-4px;border:1px solid rgba(223,161,45,.42);border-radius:50%;opacity:0;transform:scale(.55);transition:transform 250ms ease,opacity 250ms ease}.velora-socials a:hover{color:var(--v-gold);transform:translateY(-3px)}.velora-socials a:hover .social-ring{opacity:1;transform:scale(1)}
        .velora-top{position:relative;margin-top:48px;min-height:44px;display:inline-flex;align-items:center;gap:16px;padding:13px 20px 13px 15px;overflow:hidden;border:1px solid rgba(243,245,239,.9);border-radius:0;color:var(--v-white);background:transparent;cursor:pointer;font-size:12px;font-weight:750;letter-spacing:.1em}.velora-top>*:not(.top-fill){position:relative;z-index:2}.velora-top svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.top-fill{position:absolute;inset:0;background:var(--v-gold);transform:translateY(105%);transition:transform 350ms cubic-bezier(.22,1,.36,1)}.velora-top:hover{color:var(--v-bg);border-color:var(--v-gold)}.velora-top:hover .top-fill{transform:translateY(0)}
        .velora-menu{position:relative;z-index:2}.velora-menu h2{margin:0 0 34px;color:var(--v-white);font-size:14px;font-weight:750}.velora-menu>div{display:flex;flex-direction:column;align-items:flex-start;gap:20px}.velora-menu a{position:relative;color:rgba(243,245,239,.79);font-size:clamp(15px,1.2vw,18px);white-space:nowrap;transition:color 350ms cubic-bezier(.22,1,.36,1),transform 350ms cubic-bezier(.22,1,.36,1)}.velora-menu a::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:1px;background:var(--v-gold);transform:scaleX(0);transform-origin:left;transition:transform 350ms cubic-bezier(.22,1,.36,1)}.velora-menu a:hover{color:var(--v-white);transform:translateX(5px)}.velora-menu a:hover::after{transform:scaleX(1)}.velora-menu a.is-active{color:var(--v-white)}.velora-menu a.is-active::after{background:var(--v-white);transform:scaleX(1)}
        .velora-copyright{position:absolute;z-index:3;left:0;right:0;bottom:0;min-height:30px;display:grid;place-items:center;padding:6px 16px;color:var(--v-bg);background:var(--v-gold);font-size:10px;font-weight:650;text-align:center}
        @keyframes veloraTravel{to{stroke-dashoffset:-196}}@keyframes veloraFooterTravel{to{stroke-dashoffset:-262}}@keyframes veloraFloat{0%,100%{opacity:.72;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
        @media(max-width:950px){.velora-hero{min-height:650px}.velora-footer-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:60px 80px;padding-bottom:90px}.velora-brand{grid-column:1/-1}.velora-footer-lines{width:100%;opacity:.72}}
        @media(max-width:620px){.velora-hero{min-height:620px;padding:100px 24px 115px;align-items:center}.velora-hero-image{background-position:58% 42%}.velora-hero-lines{width:170%;left:-62%}.velora-eyebrow{font-size:10px;letter-spacing:.17em}.velora-hero h1{font-size:clamp(52px,17vw,78px)}.velora-hero-bottom{margin-top:32px;flex-direction:column;align-items:stretch;gap:28px}.velora-explore{align-self:flex-end}.velora-footer{width:calc(100% - 16px);min-height:0;margin:-27px 8px 8px;border-radius:22px}.velora-footer-grid{min-height:0;grid-template-columns:1fr;gap:58px;padding:64px 28px 96px}.velora-brand{grid-column:auto}.velora-brand-copy{margin-top:35px;font-size:17px}.velora-socials{margin-top:34px}.velora-top{margin-top:38px}.velora-menu h2{margin-bottom:25px}.velora-menu>div{gap:17px}.velora-menu a{font-size:17px}.velora-footer-lines{right:-45%;width:145%;height:67%;opacity:.47}}
        @media(prefers-reduced-motion:reduce){.velora-signal,.footer-signal,.velora-logo path{animation:none}.velora-explore-circle,.velora-socials a,.social-ring,.top-fill,.velora-menu a,.velora-menu a::after{transition-duration:1ms}.velora-explore:hover .velora-explore-circle,.velora-socials a:hover,.velora-menu a:hover{transform:none}}
      `}</style>
    </main>
  );
}
