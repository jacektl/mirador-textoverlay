import { select, call } from 'redux-saga/effects';
import { expectSaga } from 'redux-saga-test-plan';
import { throwError } from 'redux-saga-test-plan/providers';
import { getWindowConfig, getCanvases, getVisibleCanvases } from 'mirador/dist/es/src/state/selectors';

import { receiveAnnotation } from 'mirador/dist/es/src/state/actions';
import {
  discoveredText, requestText, receiveText, receiveTextFailure,
} from '../../src/state/actions';
import {
  discoverExternalOcr, fetchAndProcessOcr, fetchOcrMarkup,
  fetchExternalAnnotationResources, fetchAnnotationResource,
  processTextsFromAnnotations, onConfigChange,
} from '../../src/state/sagas';
import { getTexts, getTextsForVisibleCanvases } from '../../src/state/selectors';
import { parseOcr, parseIiifAnnotations } from '../../src/lib/ocrFormats';

const canvasSize = {
  height: 1000,
  width: 500,
};

describe('Discovering external OCR resources', () => {
  const windowConfig = {
    textOverlay: {
      enabled: true,
      selectable: false,
      visible: false,
    },
  };
  const canvases = [
    {
      __jsonld: {
        ...canvasSize,
        seeAlso: {
          '@id': 'http://example.com/ocr/canvasA',
          format: 'application/xml+alto',
        },
      },
      id: 'canvasA',
    },
    {
      __jsonld: {
        ...canvasSize,
        seeAlso: {
          '@id': 'http://example.com/ocr/canvasB',
          format: 'text/vnd.hocr+html',
        },
      },
      id: 'canvasB',
    },
  ];
  const windowId = '31337';

  it('should yield a discovered source for every canvas with OCR',
    () => expectSaga(
      discoverExternalOcr,
      { visibleCanvases: ['canvasA', 'canvasB'], windowId },
    ).provide([
      [select(getWindowConfig, { windowId }), windowConfig],
      [select(getCanvases, { windowId }), canvases],
      [select(getTexts), {}],
    ])
      .put(discoveredText('canvasA', 'http://example.com/ocr/canvasA'))
      .put(discoveredText('canvasB', 'http://example.com/ocr/canvasB'))
      .run());

  ['selectable', 'visible'].forEach((setting) => {
    it(`should request the texts if '${setting}' is enabled`,
      () => expectSaga(
        discoverExternalOcr,
        { visibleCanvases: ['canvasA', 'canvasB'], windowId },
      ).provide([
        [select(getWindowConfig, { windowId }),
          { textOverlay: { ...windowConfig.textOverlay, [setting]: true } }],
        [select(getCanvases, { windowId }), canvases],
        [select(getTexts), {}],
      ])
        .put(requestText('canvasA', 'http://example.com/ocr/canvasA', canvasSize))
        .put(requestText('canvasB', 'http://example.com/ocr/canvasB', canvasSize))
        .run());
  });

  it('should not do anything when the sources are already discovered',
    () => expectSaga(
      discoverExternalOcr,
      { visibleCanvases: ['canvasA', 'canvasB'], windowId },
    ).provide([
      [select(getWindowConfig, { windowId }),
        { textOverlay: { ...windowConfig.textOverlay, selectable: true } }],
      [select(getCanvases, { windowId }), canvases],
      [select(getTexts), {
        canvasA: { source: 'http://example.com/ocr/canvasA' },
        canvasB: { source: 'http://example.com/ocr/canvasB' },
      }],
    ])
      .run().then(({ effects }) => {
        expect(effects.put).toBeUndefined();
      }));

  it('should not do anything when the plugin is disabled',
    () => expectSaga(
      discoverExternalOcr,
      { visibleCanvases: ['canvasA', 'canvasB'], windowId },
    ).provide([[select(getWindowConfig, { windowId }), {}]])
      .run().then(({ effects }) => {
        expect(effects.select).toHaveLength(1);
        expect(effects.put).toBeUndefined();
      }));
});

describe('Fetching and processing external OCR', () => {
  const targetId = 'canvasA';
  const textUri = 'http://example.com/ocr/canvasA';
  const textStub = 'some dummy text';
  const parsedStub = { lines: [] };
  const err = new Error('could not fetch');

  it('should update store after successfull fetch and parse',
    () => expectSaga(
      fetchAndProcessOcr,
      { canvasSize, targetId, textUri },
    ).provide([
      [call(fetchOcrMarkup, textUri), textStub],
      [call(parseOcr, textStub, canvasSize), parsedStub],
    ])
      .put(receiveText(targetId, textUri, 'ocr', parsedStub))
      .run());

  it('should update store after failed fetch and parse',
    () => expectSaga(
      fetchAndProcessOcr,
      { canvasSize, targetId, textUri },
    ).provide([
      [call(fetchOcrMarkup, textUri), throwError(err)],
    ])
      .put(receiveTextFailure(targetId, textUri, err))
      .run());
});

describe('Fetching external annotation sources', () => {
  const targetId = 'canvasA';
  const annotationId = 'http://example.com/annos/withext.json';
  const simpleResourceId = 'http://example.com/resources/ext.json';
  const mockAnno = {
    resources: [{ resource: { '@id': simpleResourceId } }],
  };
  const simpleExternalContent = {
    '@id': simpleResourceId,
    content: 'Dummy content',
  };
  const pointerResourceId = 'http://example.com/resources/full.json';
  const pointerExternalContent = {
    id: pointerResourceId,
    value: 'Some content that is supposed to be longer',
  };

  it('should incorporate simple external content resources into annotations',
    () => expectSaga(
      fetchExternalAnnotationResources,
      { annotationId, annotationJson: mockAnno, targetId },
    ).provide([
      [call(fetchAnnotationResource, simpleResourceId), simpleExternalContent],
    ])
      .put(receiveAnnotation(
        targetId, annotationId,
        { resources: [{ resource: simpleExternalContent }] },
      ))
      .run());

  it('should resolve pointers to parts of external resources into annotations',
    () => expectSaga(
      fetchExternalAnnotationResources,
      {
        annotationId,
        annotationJson: {
          resources: [{ resource: { '@id': `${pointerResourceId}#char=5,12` } }],
        },
        targetId,
      },
    ).provide([
      [call(fetchAnnotationResource, pointerResourceId), pointerExternalContent],
    ])
      .put(receiveAnnotation(
        targetId, annotationId,
        {
          resources: [{
            resource: {
              '@id': `${pointerResourceId}#char=5,12`,
              value: 'content',
            },
          }],
        },
      ))
      .run());

  it('should not do anything if there are no external resources',
    () => expectSaga(
      fetchExternalAnnotationResources,
      {
        annotationId,
        annotationJson: {
          resources: [{ resource: { '@id': 'foo', chars: 'baz' } }],
        },
      },
    ).run().then(({ effects }) => {
      expect(effects.call).toBeUndefined();
      expect(effects.put).toBeUndefined();
    }));
});

describe('Processing text from regular annotations', () => {
  it('should parse text from annotations and forward it to the store', () => {
    const annos = [
      { motivation: 'supplementing', resource: {} },
      { resource: { '@type': 'cnt:contentAsText' } },
      { dcType: 'Line', resource: {} },
      { dcType: 'Word', resource: {} },
      { motivation: 'painting', resource: {} },
    ];
    const mockParse = { lines: [] };
    return expectSaga(
      processTextsFromAnnotations,
      {
        annotationId: 'annoList',
        annotationJson: { resources: annos },
        targetId: 'canvasA',
      },
    ).provide([
      [call(parseIiifAnnotations, annos.slice(0, 4)), mockParse],
    ])
      .put(receiveText('canvasA', 'annoList', 'annos', mockParse))
      .run();
  });
});

describe('Reacting to configuration changes', () => {
  const windowId = 'window';
  const config = { enabled: true, selectable: false, visible: false };

  it('should trigger discovery if there are no texts',
    () => expectSaga(
      onConfigChange,
      { id: windowId, payload: { textOverlay: { ...config, selectable: true } } },
    ).provide([
      [select(getTextsForVisibleCanvases, { windowId }), []],
      [select(getVisibleCanvases, { windowId }),
        [{ id: 'canvasA' }, { id: 'canvasB' }]],
      [call(discoverExternalOcr, { visibleCanvases: ['canvasA', 'canvasB'], windowId }), {}],
    ])
      .call(
        discoverExternalOcr,
        { visibleCanvases: ['canvasA', 'canvasB'], windowId },
      ).run());

  it('should trigger discovery if there are texts that are sourced from annotations',
    () => expectSaga(
      onConfigChange,
      { id: windowId, payload: { textOverlay: { ...config, selectable: true } } },
    ).provide([
      [select(getTextsForVisibleCanvases, { windowId }),
        [{ sourceType: 'annos' }, { sourceType: 'ocr' }]],
      [select(getVisibleCanvases, { windowId }),
        [{ id: 'canvasA' }, { id: 'canvasB' }]],
      [call(discoverExternalOcr, { visibleCanvases: ['canvasA', 'canvasB'], windowId }), {}],
    ])
      .call(
        discoverExternalOcr,
        { visibleCanvases: ['canvasA', 'canvasB'], windowId },
      ).run());

  it('should do nothing if the plugin is not enabled',
    () => expectSaga(
      onConfigChange,
      { id: windowId, payload: { textOverlay: { ...config, enabled: false } } },
    )
      .run().then(({ effects }) => {
        expect(effects.select).toBeUndefined();
        expect(effects.call).toBeUndefined();
      }));

  it('should do nothing if neither visibility or selection is enabled',
    () => expectSaga(
      onConfigChange,
      { id: windowId, payload: { textOverlay: config } },
    )
      .run().then(({ effects }) => {
        expect(effects.select).toBeUndefined();
        expect(effects.call).toBeUndefined();
      }));
});
