/**
 * ════════════════════════════════════════════════════════════════════════════
 *  VENDORED FROM LANDING PAGE — DO NOT EDIT IN PLACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Source of truth: NJD Services Landing Page → public/njd-navbar.js
 *                   (served at https://njd-services.net/njd-navbar.js)
 *
 *  Last synced:  2026-04-22
 *  Source mtime: 2026-04-04
 *  SHA-256:      11c621f5b0179b2f1523d3407cef14690521f203d43d4d213f0e054c0eec7d69
 *  MD5:          dad3adb05fa5bcb75aa55390d046ac7c
 *
 *  To update this file: fix in Landing first, then re-copy here (and into
 *  board.njd-services.net). Direct edits to this vendored copy WILL be lost
 *  on the next sync.
 *
 *  Note: the Landing GitHub repo (waalleedd97/njd-services-landing) does not
 *  currently track this file — the canonical copy lives in the Landing iCloud
 *  working tree. Flagged for follow-up (landing repo hygiene), not blocking.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * <njd-navbar> Web Component
 *
 * Attributes:
 *   lang="ar|en"           — controls language & RTL/LTR (default: "ar")
 *   app="landing|board|hr" — which app is active (default: "landing")
 *   logo="url"             — logo image source (default: absolute NJD logo)
 *   auth="true|false"      — show/hide badge+logout (default: "true")
 *
 * Events dispatched:
 *   "njd-lang-change"  detail: { lang: "ar"|"en" }
 *   "njd-logout"       detail: {}
 *   "njd-theme-change" detail: { theme: "light"|"dark" }
 */
(function () {
  'use strict';

  var DEFAULT_LOGO = 'https://njd-services.net/logo.png';

  /* ── Cross-subdomain cookie helpers ── */
  var _isNjd = location.hostname === 'njd-services.net' || location.hostname.endsWith('.njd-services.net');
  var _ckDomain = _isNjd ? '; domain=.njd-services.net' : '';
  var _ckSecure = location.protocol === 'https:' ? '; Secure' : '';

  function _getCookie(n) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function _setCookie(n, v) {
    document.cookie = n + '=' + encodeURIComponent(v) + _ckDomain + '; path=/; max-age=31536000; SameSite=Lax' + _ckSecure;
  }

  var FONT_URL =
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@200;300;400;500;700;800;900&display=swap';

  var I18N = {
    ar: { logout: 'خروج' },
    en: { logout: 'Logout' },
  };

  var TEMPLATE = document.createElement('template');
  TEMPLATE.innerHTML = /* html */ '\
<style>\
@import url("' + FONT_URL + '");\
:host{display:block;position:sticky;top:0;z-index:100;font-family:"Tajawal",sans-serif;height:64px;box-sizing:border-box;line-height:1.4;font-size:14px;--njd-navbar-height:64px}\
\
/* ── tokens (light) ── */\
:host{--_white:#FFF;--_g50:#FAFAFA;--_g100:#F4F4F5;--_g200:#E4E4E7;--_g300:#D4D4D8;--_g400:#A1A1AA;--_g500:#71717A;--_g600:#52525B;--_g700:#3F3F46;--_g800:#27272A;--_p50:#FAF5FF;--_p100:#F3E8FF;--_p200:#E9D5FF;--_p400:#C084FC;--_p500:#A855F7;--_p600:#9333EA;--_p700:#7E22CE;--_hdr-bg:rgba(255,255,255,.92);--_hdr-border:var(--_g200);--_hdr-shadow:0 1px 12px rgba(0,0,0,.04)}\
\
/* ── tokens (dark) ── */\
:host([data-theme=dark]){--_white:#0C0C14;--_g50:#121220;--_g100:#1C1C2E;--_g200:#2A2A40;--_g300:#3A3A55;--_g400:#606078;--_g500:#9090A8;--_g600:#B0B0C4;--_g700:#D0D0DD;--_g800:#E8E8F0;--_p50:#14102A;--_p100:#1E1845;--_p200:#2E2460;--_p400:#C084FC;--_hdr-bg:rgba(12,12,20,.92);--_hdr-border:var(--_g200);--_hdr-shadow:0 1px 12px rgba(0,0,0,.25)}\
\
/* ── header bar ── */\
.bar{background:var(--_hdr-bg);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--_hdr-border);box-shadow:var(--_hdr-shadow);transition:border-color .3s ease,box-shadow .3s ease}\
\
/* ── layout ── */\
.inner{padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between}\
:host([dir=rtl]) .inner{direction:ltr;flex-direction:row-reverse}\
\
/* ── logo ── */\
.logo{display:flex;align-items:center;flex-shrink:0}\
.logo img{height:32px;width:auto;object-fit:contain}\
:host([data-theme=dark]) .logo img{filter:brightness(1.15)}\
.logo-fallback{display:none;font-size:15px;font-weight:700;color:var(--_p600);letter-spacing:-0.3px}\
:host([data-theme=dark]) .logo-fallback{color:var(--_p400)}\
.logo img[data-broken]{display:none}\
.logo img[data-broken]~.logo-fallback{display:block}\
\
/* ── controls group ── */\
.controls{display:flex;align-items:center;gap:8px}\
:host([dir=rtl]) .controls{flex-direction:row-reverse}\
\
/* ── notification bell ── */\
.bell{position:relative;width:36px;height:36px;border-radius:50%;background:var(--_g100);border:1px solid var(--_g200);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s ease;flex-shrink:0;padding:0}\
.bell:hover{background:var(--_g200);border-color:var(--_g300)}\
.bell svg{width:16px;height:16px;stroke:var(--_g600);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\
:host([data-theme=dark]) .bell svg{stroke:var(--_g500)}\
.bell-badge{position:absolute;top:2px;right:2px;min-width:16px;height:16px;border-radius:8px;background:#EF4444;color:#fff;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px;line-height:1;pointer-events:none;transform:scale(1);transition:transform .2s cubic-bezier(.175,.885,.32,1.275)}\
.bell-badge.pop{transform:scale(1.3)}\
.bell-badge[hidden]{display:none}\
:host([auth=false]) .bell{display:none}\
\
/* ── separator ── */\
.sep{width:1px;height:24px;background:var(--_g200);margin:0 4px;flex-shrink:0}\
\
/* ── language toggle ── */\
.lang{display:flex;background:var(--_g100);border-radius:100px;padding:3px;border:1px solid var(--_g200)}\
.lang button{padding:4px 14px;border:none;border-radius:100px;background:transparent;font-family:"Tajawal",sans-serif;font-size:12px;font-weight:700;color:var(--_g400);cursor:pointer;transition:all .3s ease;line-height:1.4}\
.lang button.active{background:linear-gradient(135deg,var(--_p600),var(--_p700));color:#fff;box-shadow:0 2px 10px rgba(147,51,234,.3)}\
.lang button:not(.active):hover{color:var(--_g600)}\
\
/* ── theme toggle ── */\
.theme{width:36px;height:36px;border-radius:50%;background:var(--_g100);border:1px solid var(--_g200);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s ease;position:relative;overflow:hidden;flex-shrink:0}\
.theme:hover{background:var(--_g200);border-color:var(--_g300)}\
.theme svg{width:16px;height:16px;position:absolute;transition:all .45s cubic-bezier(.4,0,.2,1);stroke:var(--_g600);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\
.sun{opacity:1;transform:rotate(0) scale(1)}\
.moon{opacity:0;transform:rotate(-90deg) scale(.5)}\
:host([data-theme=dark]) .sun{opacity:0;transform:rotate(90deg) scale(.5)}\
:host([data-theme=dark]) .moon{opacity:1;transform:rotate(0) scale(1);stroke:var(--_p400)}\
\
/* ── user menu (name + dropdown) ── */\
.user-menu{position:relative}\
.user-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:var(--_p50);border:1px solid var(--_p100);border-radius:100px;font-family:"Tajawal",sans-serif;font-size:15px;font-weight:600;color:var(--_p700);white-space:nowrap;cursor:pointer;transition:all .2s ease;border:1px solid var(--_p100)}\
.user-btn:hover{background:var(--_p100);border-color:var(--_p200)}\
:host([data-theme=dark]) .user-btn{color:var(--_p400)}\
:host([data-theme=dark]) .user-btn:hover{background:var(--_p100)}\
.user-btn .chevron{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s ease;flex-shrink:0}\
.user-menu.open .chevron{transform:rotate(180deg)}\
:host([auth=false]) .user-menu,:host([auth=false]) .user-name-skel{display:none}\
.user-name-skel{width:80px;height:32px;border-radius:100px;background:var(--_g200);animation:njd-skel 1.5s ease-in-out infinite}\
.user-btn.loaded{animation:njd-name-in .2s ease forwards}\
@keyframes njd-skel{0%,100%{opacity:.4}50%{opacity:.8}}\
@keyframes njd-name-in{from{opacity:0}to{opacity:1}}\
\
/* ── user dropdown ── */\
.user-drop{display:none;position:absolute;top:calc(100% + 8px);min-width:190px;background:var(--_white);border:1px solid var(--_g200);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:6px;z-index:9999;animation:njd-drop-in .15s ease}\
:host([data-theme=dark]) .user-drop{box-shadow:0 8px 24px rgba(0,0,0,.35)}\
:host([dir=rtl]) .user-drop{left:0;right:auto}\
:host([dir=ltr]) .user-drop{right:0;left:auto}\
.user-menu.open .user-drop{display:block}\
.user-drop-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;font-family:"Tajawal",sans-serif;font-size:13px;font-weight:500;color:var(--_g700);cursor:pointer;transition:background .15s ease;border:none;background:none;width:100%;text-align:inherit}\
.user-drop-item:hover{background:var(--_g100)}\
.user-drop-item.danger{color:#EF4444}\
.user-drop-item.danger:hover{background:rgba(239,68,68,.06)}\
:host([data-theme=dark]) .user-drop-item.danger:hover{background:rgba(239,68,68,.1)}\
.user-drop-item svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}\
.user-drop-sep{height:1px;background:var(--_g200);margin:4px 6px}\
@keyframes njd-drop-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}\
\
/* ── unauthenticated ── */\
:host([auth=false]) .sep-auth{display:none}\
\
/* ── theme transition helper ── */\
.transitioning,.transitioning *,.transitioning *::before,.transitioning *::after{transition:background-color .4s ease,color .4s ease,border-color .4s ease,box-shadow .4s ease,fill .4s ease,stroke .4s ease !important}\
\
/* ── responsive ── */\
@media(max-width:768px){\
  .inner{padding:0 12px;height:48px}\
  .controls{gap:6px}\
  .sep-auth{display:none}\
  .lang button{padding:4px 10px;font-size:11px}\
  .theme,.bell{width:32px;height:32px}\
  .theme svg,.bell svg{width:14px;height:14px}\
  .user-btn{font-size:13px;padding:5px 10px}\
  .logo img{height:26px}\
}\
</style>\
\
<div class="bar" part="bar">\
  <div class="inner">\
    <div class="logo">\
      <img alt="NJD Games">\
      <span class="logo-fallback">NJD Games</span>\
    </div>\
    <div class="controls">\
      <div class="lang" role="radiogroup" aria-label="Switch language">\
        <button data-lang="ar" role="radio">عربي</button>\
        <button data-lang="en" role="radio">EN</button>\
      </div>\
      <button class="theme" aria-label="Toggle dark mode">\
        <svg class="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>\
        <svg class="moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>\
      </button>\
      <button class="bell" aria-label="Notifications">\
        <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>\
        <span class="bell-badge" hidden></span>\
      </button>\
      <div class="sep sep-auth"></div>\
      <div class="user-name-skel"></div>\
      <div class="user-menu">\
        <button class="user-btn" style="display:none">\
          <span class="user-btn-name"></span>\
          <svg class="chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>\
        </button>\
        <div class="user-drop">\
          <button class="user-drop-item" data-action="profile">\
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>\
            <span class="drop-profile-text"></span>\
          </button>\
          <div class="user-drop-sep"></div>\
          <button class="user-drop-item danger" data-action="logout">\
            <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>\
            <span class="drop-logout-text"></span>\
          </button>\
        </div>\
      </div>\
    </div>\
  </div>\
</div>';

  class NjdNavbar extends HTMLElement {
    static get observedAttributes() {
      return ['lang', 'app', 'logo', 'auth', 'user-name', 'notification-count', 'is-admin'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));

      this._bar = this.shadowRoot.querySelector('.bar');
      this._logoImg = this.shadowRoot.querySelector('.logo img');
      this._langBtns = this.shadowRoot.querySelectorAll('.lang button');
      this._themeBtn = this.shadowRoot.querySelector('.theme');
      this._userMenu = this.shadowRoot.querySelector('.user-menu');
      this._userBtn = this.shadowRoot.querySelector('.user-btn');
      this._userBtnName = this.shadowRoot.querySelector('.user-btn-name');
      this._dropProfileText = this.shadowRoot.querySelector('.drop-profile-text');
      this._dropLogoutText = this.shadowRoot.querySelector('.drop-logout-text');
      this._userNameSkel = this.shadowRoot.querySelector('.user-name-skel');
      this._bellBtn = this.shadowRoot.querySelector('.bell');
      this._bellBadge = this.shadowRoot.querySelector('.bell-badge');
      this._scrollTicking = false;

      this._onScroll = this._onScroll.bind(this);
    }

    /* ── lifecycle ── */

    connectedCallback() {
      // ── Resolve language: cookie > localStorage > browser > 'en' ──
      var cookieLang = _getCookie('njd-lang');
      var savedLang = cookieLang || localStorage.getItem('njd-lang');
      if (!savedLang) {
        var navLang = (navigator.language || '').toLowerCase();
        savedLang = navLang.startsWith('ar') ? 'ar' : 'en';
      }
      // Apply resolved lang (_connected is false so attributeChangedCallback won't persist yet)
      this.setAttribute('lang', savedLang);

      // defaults for other attrs
      if (!this.hasAttribute('app')) this.setAttribute('app', 'landing');
      if (!this.hasAttribute('logo')) this.setAttribute('logo', DEFAULT_LOGO);

      // sync theme: cookie (cross-subdomain) > <html> state > localStorage > default
      var htmlEl = document.documentElement;
      var theme =
        _getCookie('njd-theme') ||
        (htmlEl.classList.contains('dark') ? 'dark' : null) ||
        htmlEl.getAttribute('data-theme') ||
        localStorage.getItem('njd-theme') ||
        localStorage.getItem('theme') ||
        'light';
      this._applyTheme(theme);

      // watch <html> for external theme changes (.dark class or data-theme attr)
      this._themeObserver = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          var externalTheme = null;
          if (m.type === 'attributes' && m.attributeName === 'class') {
            externalTheme = htmlEl.classList.contains('dark') ? 'dark' : 'light';
          }
          if (m.type === 'attributes' && m.attributeName === 'data-theme') {
            externalTheme = htmlEl.getAttribute('data-theme') || 'light';
          }
          if (externalTheme && externalTheme !== self.getAttribute('data-theme')) {
            self.setAttribute('data-theme', externalTheme);
            _setCookie('njd-theme', externalTheme);
            localStorage.setItem('njd-theme', externalTheme);
            localStorage.setItem('theme', externalTheme);
          }
        }
      });
      this._themeObserver.observe(htmlEl, { attributes: true, attributeFilter: ['class', 'data-theme'] });

      // set dir on host
      this._applyDir();

      // render text
      this._render();

      // logo error fallback
      var self = this;
      this._logoImg.addEventListener('error', function () {
        self._logoImg.setAttribute('data-broken', '');
      });

      // events
      this._langBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var lang = btn.getAttribute('data-lang');
          if (lang !== self.getAttribute('lang')) {
            self.setAttribute('lang', lang);
          }
        });
      });

      this._themeBtn.addEventListener('click', function () {
        var cur = self.getAttribute('data-theme') || 'light';
        var next = cur === 'light' ? 'dark' : 'light';
        self._bar.classList.add('transitioning');
        self._applyTheme(next);
        self.dispatchEvent(
          new CustomEvent('njd-theme-change', {
            bubbles: true,
            composed: true,
            detail: { theme: next },
          })
        );
        setTimeout(function () {
          self._bar.classList.remove('transitioning');
        }, 450);
      });

      // User menu toggle
      this._userBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self._userMenu.classList.toggle('open');
      });

      // Dropdown actions
      this.shadowRoot.querySelector('[data-action="profile"]').addEventListener('click', function () {
        self._userMenu.classList.remove('open');
        self.dispatchEvent(new CustomEvent('njd-profile-click', { bubbles: true, composed: true }));
        window.location.href = 'https://njd-services.net/#profile';
      });
      this.shadowRoot.querySelector('[data-action="logout"]').addEventListener('click', function () {
        self._userMenu.classList.remove('open');
        self.dispatchEvent(new CustomEvent('njd-logout', { bubbles: true, composed: true }));
      });

      // Close dropdown on outside click or Escape
      document.addEventListener('click', function () { self._userMenu.classList.remove('open'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') self._userMenu.classList.remove('open'); });

      this._bellBtn.addEventListener('click', function () {
        self.dispatchEvent(
          new CustomEvent('njd-notification-click', { bubbles: true, composed: true })
        );
      });

      window.addEventListener('scroll', this._onScroll, { passive: true });

      // Mark as connected — future attribute changes will persist to cookie/localStorage
      this._connected = true;

      // Persist the resolved language and notify the host app
      var resolvedLang = this.getAttribute('lang') || 'en';
      _setCookie('njd-lang', resolvedLang);
      localStorage.setItem('njd-lang', resolvedLang);
      document.documentElement.setAttribute('lang', resolvedLang);
      document.documentElement.setAttribute('dir', resolvedLang === 'ar' ? 'rtl' : 'ltr');
      this.dispatchEvent(
        new CustomEvent('njd-lang-change', {
          bubbles: true,
          composed: true,
          detail: { lang: resolvedLang },
        })
      );
    }

    disconnectedCallback() {
      window.removeEventListener('scroll', this._onScroll);
      if (this._themeObserver) this._themeObserver.disconnect();
    }

    attributeChangedCallback(name) {
      if (name === 'lang') {
        this._applyDir();
        this._render();

        // Only persist and dispatch after connectedCallback has resolved the language
        if (this._connected) {
          var lang = this.getAttribute('lang') || 'en';
          _setCookie('njd-lang', lang);
          localStorage.setItem('njd-lang', lang);
          document.documentElement.setAttribute('lang', lang);
          document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

          this.dispatchEvent(
            new CustomEvent('njd-lang-change', {
              bubbles: true,
              composed: true,
              detail: { lang: lang },
            })
          );
        }
      }
      if (name === 'logo') {
        var src = this.getAttribute('logo') || DEFAULT_LOGO;
        if (this._logoImg) {
          this._logoImg.removeAttribute('data-broken');
          this._logoImg.setAttribute('src', src);
        }
      }
      if (name === 'app') {
        this._render();
      }
      if (name === 'user-name') {
        this._showUserName(this.getAttribute('user-name') || '');
      }
      if (name === 'notification-count') {
        this._updateBellBadge();
      }
    }

    /* ── internal ── */

    _applyTheme(theme) {
      this.setAttribute('data-theme', theme);
      // Sync to cookie (cross-subdomain) + localStorage
      _setCookie('njd-theme', theme);
      localStorage.setItem('njd-theme', theme);
      localStorage.setItem('theme', theme);
      // Sync .dark class for Tailwind-based apps
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      document.documentElement.setAttribute('data-theme', theme);
    }

    _applyDir() {
      var lang = this.getAttribute('lang') || 'ar';
      this.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    }

    _render() {
      var lang = this.getAttribute('lang') || 'ar';
      var app = this.getAttribute('app') || 'landing';
      var t = I18N[lang] || I18N.ar;

      // logo src
      var logoSrc = this.getAttribute('logo') || DEFAULT_LOGO;
      if (this._logoImg && this._logoImg.getAttribute('src') !== logoSrc) {
        this._logoImg.removeAttribute('data-broken');
        this._logoImg.setAttribute('src', logoSrc);
      }

      // lang buttons
      this._langBtns.forEach(function (btn) {
        var isActive = btn.getAttribute('data-lang') === lang;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', String(isActive));
      });

      // dropdown text
      this._dropProfileText.textContent = lang === 'ar' ? 'الملف الشخصي' : 'Profile';
      this._dropLogoutText.textContent = t.logout;

      // user name
      var uname = this.getAttribute('user-name') || '';
      if (uname) this._showUserName(uname);
    }

    _showUserName(name) {
      if (!this._userBtn) return;
      if (name) {
        this._userBtnName.textContent = name;
        this._userBtn.style.display = '';
        this._userBtn.classList.add('loaded');
        if (this._userNameSkel) this._userNameSkel.style.display = 'none';
      } else {
        this._userBtn.style.display = 'none';
        this._userBtn.classList.remove('loaded');
        if (this._userNameSkel) this._userNameSkel.style.display = '';
      }
    }

    _updateBellBadge() {
      if (!this._bellBadge) return;
      var raw = parseInt(this.getAttribute('notification-count') || '0', 10);
      var count = isNaN(raw) ? 0 : raw;
      if (count <= 0) {
        this._bellBadge.hidden = true;
        return;
      }
      this._bellBadge.hidden = false;
      this._bellBadge.textContent = count > 9 ? '9+' : String(count);
      // pop animation
      this._bellBadge.classList.remove('pop');
      var badge = this._bellBadge;
      void badge.offsetWidth; // force reflow
      badge.classList.add('pop');
      setTimeout(function () { badge.classList.remove('pop'); }, 200);
    }

    _onScroll() {
      var self = this;
      if (!this._scrollTicking) {
        requestAnimationFrame(function () {
          self._bar.classList.toggle('scrolled', window.scrollY > 10);
          self._scrollTicking = false;
        });
        this._scrollTicking = true;
      }
    }
  }

  if (!customElements.get('njd-navbar')) {
    customElements.define('njd-navbar', NjdNavbar);
  }
})();
