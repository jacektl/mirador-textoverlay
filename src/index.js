import { updateWindow } from 'mirador/dist/es/src/state/actions';
import { getWindowConfig } from 'mirador/dist/es/src/state/selectors';

import { textsReducer } from './state/reducers';
import textSaga from './state/sagas';
import { getTextsForVisibleCanvases, getWindowTextOverlayOptions } from './state/selectors';
import MiradorTextOverlay from './components/MiradorTextOverlay';
import TextOverlaySettingsBubble from './components/TextOverlaySettingsBubble';

export default [
  {
    component: MiradorTextOverlay,
    mapStateToProps: (state, { windowId }) => ({
      pageTexts: getTextsForVisibleCanvases(state, { windowId })
        .filter((canvasText) => !canvasText.isFetching)
        .map((canvasText) => ({
          ...canvasText.text,
          source: canvasText.source,
        })),
      windowId,
      ...getWindowTextOverlayOptions(state, { windowId }),
    }),
    mode: 'add',
    reducers: {
      texts: textsReducer,
    },
    saga: textSaga,
    target: 'OpenSeadragonViewer',
  },
  {
    component: TextOverlaySettingsBubble,
    mapDispatchToProps: (dispatch, { windowId }) => ({
      updateWindowTextOverlayOptions: (options) => dispatch(
        updateWindow(windowId, { textOverlay: options }),
      ),
    }),
    mapStateToProps: (state, { windowId }) => ({
      imageToolsEnabled: getWindowConfig(state, { windowId }).imageToolsEnabled ?? false,
      textsAvailable: getTextsForVisibleCanvases(state, { windowId }).length > 0,
      textsFetching: getTextsForVisibleCanvases(state, { windowId }).some((t) => t.isFetching),
      windowTextOverlayOptions: getWindowTextOverlayOptions(state, { windowId }),
    }),
    mode: 'add',
    target: 'OpenSeadragonViewer',
  },
];
