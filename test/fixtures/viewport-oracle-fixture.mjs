export function createPassingViewportFixture() {
  return {
    name: 'passing-two-sheet-dom-text',
    tiptapHostCount: 1,
    proseMirrorCount: 1,
    primaryTextSurface: {
      tagName: 'div',
      isCanvasBitmap: false,
      computedStyle: {
        transform: 'none',
      },
    },
    sheets: [
      { id: 'sheet-1', rect: { top: 0, left: 0, width: 600, height: 800 } },
      { id: 'sheet-2', rect: { top: 840, left: 0, width: 600, height: 800 } },
    ],
    gapRects: [
      { id: 'gap-1', top: 800, left: 0, width: 600, height: 40 },
    ],
    textRects: [
      { text: 'before boundary', top: 120, left: 72, width: 420, height: 24 },
      { text: 'after boundary', top: 900, left: 72, width: 420, height: 24 },
    ],
    continuationProbe: {
      hasTextBeforeBoundary: true,
      hasTextAfterBoundary: true,
      nextSheetHasTextAfterBoundary: true,
      textHiddenInsideSinglePageScroll: false,
    },
  };
}

export function createGapFailureViewportFixture() {
  const fixture = createPassingViewportFixture();
  return {
    ...fixture,
    name: 'gap-text-failure',
    textRects: [
      ...fixture.textRects,
      { text: 'leaked gap text', top: 812, left: 72, width: 420, height: 20 },
    ],
  };
}

export function createScaleCanvasFailureViewportFixture() {
  const fixture = createPassingViewportFixture();
  return {
    ...fixture,
    name: 'scale-canvas-failure',
    primaryTextSurface: {
      tagName: 'canvas',
      isCanvasBitmap: true,
      computedStyle: {
        transform: 'matrix(0.9, 0, 0, 0.9, 0, 0)',
      },
    },
  };
}

export function createCurrentStaticPageExpectedFailFixture(sourceFacts = {}) {
  return {
    name: 'current-static-tiptap-page-expected-fail',
    tiptapHostCount: sourceFacts.tiptapHostCount ?? 1,
    proseMirrorCount: sourceFacts.proseMirrorCount ?? 1,
    primaryTextSurface: {
      tagName: sourceFacts.primaryTextSurfaceTagName || 'div',
      isCanvasBitmap: Boolean(sourceFacts.primaryTextSurfaceIsCanvasBitmap),
      computedStyle: {
        transform: sourceFacts.primaryTextTransform || 'none',
      },
    },
    sheets: [
      { id: 'sheet-1', rect: { top: 0, left: 0, width: 600, height: 800 } },
    ],
    gapRects: [],
    textRects: [
      { text: 'long text hidden inside one static page', top: 120, left: 72, width: 420, height: 24 },
    ],
    continuationProbe: {
      hasTextBeforeBoundary: true,
      hasTextAfterBoundary: false,
      nextSheetHasTextAfterBoundary: false,
      textHiddenInsideSinglePageScroll: true,
    },
  };
}
