window.TooltipHelper = window.TooltipHelper || (() => {
  let tooltipEl = null;
  let activeTrigger = null;

  const ensureTooltip = () => {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'df-tooltip';
    tooltipEl.id = 'df-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.hidden = true;
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  };

  const setPosition = (trigger) => {
    if (!trigger || !tooltipEl) return;
    const rect = trigger.getBoundingClientRect();
    const ttRect = tooltipEl.getBoundingClientRect();
    const left = Math.min(window.innerWidth - ttRect.width - 8, Math.max(8, rect.left + (rect.width / 2) - (ttRect.width / 2)));
    const top = Math.max(8, rect.top - ttRect.height - 8);
    tooltipEl.style.left = `${left + window.scrollX}px`;
    tooltipEl.style.top = `${top + window.scrollY}px`;
  };

  const hide = () => {
    if (!tooltipEl) return;
    tooltipEl.hidden = true;
    if (activeTrigger?.getAttribute('aria-describedby') === tooltipEl.id) {
      activeTrigger.removeAttribute('aria-describedby');
    }
    activeTrigger = null;
  };

  const show = (trigger) => {
    const content = String(trigger?.dataset.tooltipContent || '').trim();
    if (!content) return;
    ensureTooltip();
    tooltipEl.textContent = content;
    tooltipEl.hidden = false;
    activeTrigger = trigger;
    trigger.setAttribute('aria-describedby', tooltipEl.id);
    setPosition(trigger);
  };

  const toggle = (trigger) => {
    if (!trigger) return;
    if (!tooltipEl?.hidden && activeTrigger === trigger) {
      hide();
      return;
    }
    show(trigger);
  };

  const bindTrigger = (trigger) => {
    if (!trigger || trigger.dataset.tooltipBound === '1') return;
    trigger.dataset.tooltipBound = '1';
    if (!trigger.hasAttribute('tabindex') && trigger.tagName !== 'BUTTON') trigger.tabIndex = 0;

    trigger.addEventListener('mouseenter', () => show(trigger));
    trigger.addEventListener('mouseleave', () => hide());
    trigger.addEventListener('focus', () => show(trigger));
    trigger.addEventListener('blur', () => hide());
    trigger.addEventListener('click', (event) => {
      if (trigger.dataset.tooltipToggle === 'true') {
        event.preventDefault();
        event.stopPropagation();
        toggle(trigger);
      }
    });
  };

  document.addEventListener('click', (event) => {
    if (!tooltipEl || tooltipEl.hidden) return;
    if (event.target.closest('[data-tooltip-content]')) return;
    hide();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });

  window.addEventListener('resize', () => {
    if (activeTrigger && tooltipEl && !tooltipEl.hidden) setPosition(activeTrigger);
  });

  return {
    bind(root = document) {
      root.querySelectorAll('[data-tooltip-content]').forEach(bindTrigger);
    },
    show,
    hide,
  };
})();
