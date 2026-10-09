import { APP_ROUTES, PRODUCT_ROUTES, ACCREDITATION_SUBROUTES } from '../data/routes.js'
import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

const REMOTE_LOGO = 'https://partners.mediqo.health/wp-content/uploads/2025/11/Group-2.png'

function initials(name = 'Riverside Medical Centre') {
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || 'RM').toUpperCase()
}

function userInitials(user = {}) {
  return `${String(user.firstName || 'P').charAt(0)}${String(user.lastName || 'M').charAt(0)}`.toUpperCase()
}

function navLink(route, path) {
  const active = path === route.path
  return `<a class="sidebar-link ${active ? 'active' : ''}" href="${route.path}" data-nav="${route.path}" aria-current="${active ? 'page' : 'false'}" title="${escapeHtml(route.label)}">
    <span class="sidebar-icon">${icon(route.icon, 21)}</span><span>${escapeHtml(route.label)}</span>
  </a>`
}

function accreditationSubmenu(currentView = 'overview') {
  return `<div class="accreditation-sidebar-submenu" aria-label="Accreditation Assistant sections">${ACCREDITATION_SUBROUTES.map((item) => {
    const active = item.view === currentView || (currentView === 'requirement' && item.view === 'requirements')
    if (!item.available) {
      return `<span class="accreditation-sidebar-item is-disabled" aria-disabled="true" title="This section will activate as its production workflow is connected.">${escapeHtml(item.label)}</span>`
    }
    return `<button type="button" class="accreditation-sidebar-item ${active ? 'active' : ''}" data-accreditation-view="${escapeHtml(item.view)}" aria-current="${active ? 'page' : 'false'}">${escapeHtml(item.label)}</button>`
  }).join('')}</div>`
}

export function renderShell({ path = '/', content = '', alertsOpen = false, userMenuOpen = false, mobileOpen = false, sidebarCollapsed = false, devMode = false, selectedPractice = 'Riverside Medical Centre', user = null, accreditationView = 'overview' } = {}) {
  const signedIn = Boolean(user)
  const profileInitials = signedIn ? userInitials(user) : ''
  const role = user?.jobTitle || 'Practice Manager'

  return `
  <div class="app-layout ${mobileOpen ? 'mobile-nav-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}">
    <aside class="sidebar" aria-label="Primary navigation">
      <div class="sidebar-brand-row">
        <a href="/" data-nav="/" class="brand-link" aria-label="MediQo home">
          <img class="mediqo-logo" src="${REMOTE_LOGO}" data-logo-fallback="/assets/mediqo-logo.png" alt="MediQo" />
          <img class="mediqo-logo-mark" src="/favicon.svg" alt="" aria-hidden="true" />
          <span class="brand-wordmark" aria-hidden="true">MEDIQO</span>
        </a>
        <button class="icon-button sidebar-collapse" type="button" data-action="toggle-sidebar" aria-label="${sidebarCollapsed ? 'Expand' : 'Collapse'} navigation" aria-expanded="${!sidebarCollapsed}" title="${sidebarCollapsed ? 'Expand' : 'Collapse'} navigation">${icon('notebook', 18)}</button>
      </div>
      ${signedIn ? `<button class="practice-selector" type="button" aria-label="Select practice" data-action="toggle-practice-menu" title="${escapeHtml(selectedPractice)}">
        <span class="avatar avatar-sm">${initials(selectedPractice)}</span><span class="practice-name">${escapeHtml(selectedPractice)}</span><span class="practice-chevron">${icon('down', 16)}</span>
      </button>` : ''}
      <nav class="sidebar-nav">
        <div class="nav-group">${APP_ROUTES.map((r) => `${navLink(r, path)}${r.id === 'accreditation' && path === '/accreditation' ? accreditationSubmenu(accreditationView) : ''}`).join('')}</div>
        <div class="nav-divider"></div>
        <div class="nav-group product-group">${PRODUCT_ROUTES.map((r) => navLink(r, path)).join('')}</div>
      </nav>
      ${signedIn ? `<div class="sidebar-user-wrap">
        <button class="sidebar-user" type="button" data-action="toggle-user-menu" aria-expanded="${userMenuOpen}">
          <span class="avatar">${profileInitials}</span>
          <span class="user-copy"><strong>${escapeHtml(role)}</strong><small>${escapeHtml(selectedPractice)}</small></span>
          <span class="sidebar-user-chevron">${icon('down', 16)}</span>
        </button>
        ${userMenuOpen ? `<div class="user-menu" role="menu">
          <button type="button" role="menuitem" data-action="help">Help & keyboard tips</button>
          <button type="button" role="menuitem" data-action="sign-out">Sign out</button>
          ${devMode ? '<button type="button" role="menuitem" data-action="reset-prototype">Reset local data</button>' : ''}
        </div>` : ''}
      </div>` : ''}
    </aside>
    <div class="mobile-scrim" data-action="close-mobile-nav"></div>
    <section class="app-main">
      <header class="topbar">
        <button class="icon-button mobile-menu" type="button" aria-label="Open navigation" data-action="toggle-mobile-nav">${icon('menu', 21)}</button>
        <div class="topbar-spacer"></div>
        <button class="feature-request-button" type="button" data-action="request-feature">${icon('sparkle', 16)}<span>Request a feature</span></button>
        <button class="pms-button" type="button" data-action="connect-pms">${icon('refresh', 17)}<span>Connect your PMS</span></button>
        <div class="alert-wrap">
          <button class="icon-button alert-button" type="button" aria-label="Alerts" data-action="toggle-alerts" aria-expanded="${alertsOpen}">${icon('bell', 20)}<span class="unread-dot"></span></button>
          ${alertsOpen ? `<div class="alerts-popover" role="dialog" aria-label="Recent alerts">
            <div class="popover-title"><strong>Recent Alerts</strong><span class="count-pill">3</span></div>
            <button class="alert-mini" data-nav="/alerts" type="button"><i class="dot purple"></i><span>RACGP updates</span></button>
            <button class="alert-mini" data-nav="/alerts" type="button"><i class="dot red"></i><span>Medicare changes</span></button>
            <button class="alert-mini" data-nav="/alerts" type="button"><i class="dot orange"></i><span>Modern Award update</span></button>
            <button class="view-all" type="button" data-nav="/alerts">View all alerts ${icon('chevron', 16)}</button>
          </div>` : ''}
        </div>
        <button class="help-button" type="button" data-action="help">${icon('help', 18)}<span>Help</span></button>
        ${signedIn
          ? `<button class="top-avatar" type="button" data-action="toggle-user-menu-top" aria-label="${escapeHtml(role)} menu"><span class="avatar">${profileInitials}</span>${icon('down', 15)}</button>`
          : '<button class="help-button auth-button" type="button" data-action="sign-in"><span>Sign in</span></button>'}
      </header>
      <main class="page-area" id="page-content">${content}</main>
    </section>
  </div>`
}
