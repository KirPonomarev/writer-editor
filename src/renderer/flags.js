(() => {
  const qs = new URLSearchParams(window.location.search);
  // ?USE_TIPTAP=1  -> true
  window.__USE_TIPTAP = qs.get('USE_TIPTAP') === '1';
  window.__PRODUCT_PROFILE = qs.get('PRODUCT_PROFILE') === 'WRITER_LOCAL_V1'
    ? 'WRITER_LOCAL_V1'
    : ['WRITER_LOCAL_ATLAS_V2', 'WRITER_LOCAL_MANUAL_MAP_V3', 'WRITER_LOCAL_MANUAL_MAP_V4', 'WRITER_LOCAL_EXACT_ATLAS_V5', 'WRITER_LOCAL_ATLAS_EVIDENCE_REATTACHMENT_V6', 'WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7'].includes(qs.get('PRODUCT_PROFILE')) ? qs.get('PRODUCT_PROFILE') : '';

  const applyWriterLocalPresentationCut = () => {
    if (window.__PRODUCT_PROFILE !== 'WRITER_LOCAL_V1') return;
    document.body.dataset.productProfile = 'WRITER_LOCAL_V1';
    const selectors = [
      '[data-mode="plan"]',
      '[data-mode="review"]',
      '[data-right-tab="comments"]',
      '[data-right-tab="atlas"]',
      '[data-toolbar-item-key="review-comment"]',
      '[data-atlas-reachability-opener]',
    ];
    for (const element of document.querySelectorAll(selectors.join(','))) {
      element.hidden = true;
      element.disabled = true;
      element.tabIndex = -1;
      element.setAttribute('aria-hidden', 'true');
      element.style.setProperty('display', 'none', 'important');
    }
  };

  const applyWriterAtlasPresentationCut = () => {
    if (!['WRITER_LOCAL_ATLAS_V2', 'WRITER_LOCAL_MANUAL_MAP_V3', 'WRITER_LOCAL_MANUAL_MAP_V4', 'WRITER_LOCAL_EXACT_ATLAS_V5', 'WRITER_LOCAL_ATLAS_EVIDENCE_REATTACHMENT_V6', 'WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7'].includes(window.__PRODUCT_PROFILE)) return;
    document.body.dataset.productProfile = window.__PRODUCT_PROFILE;
    const selectors = [
      '[data-mode="plan"]',
      '[data-mode="review"]',
      '[data-right-tab="comments"]',
      '[data-toolbar-item-key="review-comment"]',
      '[data-atlas-reachability-opener]',
    ];
    for (const element of document.querySelectorAll(selectors.join(','))) {
      element.hidden = true;
      element.disabled = true;
      element.tabIndex = -1;
      element.setAttribute('aria-hidden', 'true');
      element.style.setProperty('display', 'none', 'important');
    }
  };

  applyWriterLocalPresentationCut();
  document.addEventListener('DOMContentLoaded', applyWriterLocalPresentationCut, { once: true });
  applyWriterAtlasPresentationCut();
  document.addEventListener('DOMContentLoaded', applyWriterAtlasPresentationCut, { once: true });
  console.log('[flags] __USE_TIPTAP =', window.__USE_TIPTAP);
})();
