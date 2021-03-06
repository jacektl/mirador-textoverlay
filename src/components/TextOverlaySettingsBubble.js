import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { MiradorMenuButton } from 'mirador/dist/es/src/components/MiradorMenuButton';
import Slider from '@material-ui/core/Slider';
import TextIcon from '@material-ui/icons/TextFields';
import CloseIcon from '@material-ui/icons/Close';
import SubjectIcon from '@material-ui/icons/Subject';
import OpacityIcon from '@material-ui/icons/Opacity';
import CircularProgress from '@material-ui/core/CircularProgress';
import useTheme from '@material-ui/core/styles/useTheme';

import TextSelectIcon from './TextSelectIcon';

/**
 * Based on https://gist.github.com/danieliser/b4b24c9f772066bcf0a6
 */
const changeAlpha = (color, opacity) => {
  if (color[0] === '#') {
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex += hex;
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  if (color.startsWith('rgba')) {
    return color.replace(/[^,]+(?=\))/, opacity);
  }
  console.error(`Unsupported color: ${color}`);
  return color;
};

/** Control text overlay settings  */
const TextOverlaySettingsBubble = ({
  windowTextOverlayOptions, imageToolsEnabled, textsAvailable,
  textsFetching, updateWindowTextOverlayOptions, t,
}) => {
  const {
    enabled, visible, selectable, opacity,
  } = windowTextOverlayOptions;
  const [open, setOpen] = useState(enabled && (visible || selectable));
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const { palette } = useTheme();
  const bubbleBg = palette.shades.main;
  // CSS voodoo to render a border with a margin on the top and bottom
  const bubbleFg = palette.getContrastText(bubbleBg);
  const borderImageSource = 'linear-gradient('
    + `to bottom, ${changeAlpha(bubbleFg, 0)}) 20%,`
    + `${changeAlpha(bubbleFg, 0.2)} 20% 80%,`
    + `${changeAlpha(bubbleFg, 0)} 80%`;
  const borderRight = `1px solid ${changeAlpha(bubbleFg, 0.2)}`;
  const toggledBubbleBg = changeAlpha(bubbleFg, 0.25);

  if (!enabled || !textsAvailable) {
    return null;
  }
  return (
    <div
      className="MuiPaper-elevation4"
      style={{
        backgroundColor: changeAlpha(bubbleBg, 0.8),
        borderRadius: 25,
        position: 'absolute',
        right: 8,
        // The mirador-image-tools plugin renders itself at the same position,
        // so if it's active, position the menu lower
        top: imageToolsEnabled ? 66 : 8,
        zIndex: 999,
      }}
    >
      {(open && !textsFetching)
      && (
      <>
        <div style={{
          borderImageSlice: 1,
          borderImageSource,
          borderRight,
          display: 'inline-block',
          paddingRight: 8,
        }}
        >
          <MiradorMenuButton
            aria-label={t('textSelect')}
            onClick={() => updateWindowTextOverlayOptions({
              ...windowTextOverlayOptions,
              selectable: !selectable,
            })}
            aria-pressed={selectable}
            style={{ backgroundColor: selectable && toggledBubbleBg }}
          >
            <TextSelectIcon />
          </MiradorMenuButton>
        </div>
        <div style={{ display: 'inline-block', paddingLeft: 8 }}>
          <MiradorMenuButton
            aria-label={t('textVisible')}
            onClick={() => {
              updateWindowTextOverlayOptions({
                ...windowTextOverlayOptions,
                visible: !visible,
              });
              if (showOpacitySlider && visible) {
                setShowOpacitySlider(false);
              }
            }}
            aria-pressed={visible}
            style={{ backgroundColor: visible && toggledBubbleBg }}
          >
            <TextIcon />
          </MiradorMenuButton>
        </div>
        <div style={{
          // CSS voodoo to render a border with a margin on the top and bottom
          borderImageSlice: 1,
          borderImageSource,
          borderRight,
          display: 'inline-block',
          paddingRight: 8,
        }}
        >
          <MiradorMenuButton
            id="text-opacity-slider-label"
            disabled={!visible}
            aria-label={t('textOpacity')}
            aria-controls="text-opacity-slider"
            aria-expanded={showOpacitySlider}
            onClick={() => setShowOpacitySlider(!showOpacitySlider)}
            style={{
              backgroundColor: showOpacitySlider && changeAlpha(bubbleFg, 0.1),
            }}
          >
            <OpacityIcon />
          </MiradorMenuButton>
          {visible && showOpacitySlider
          && (
          <div
            data-test-id="text-opacity-slider"
            id="text-opacity-slider"
            aria-labelledby="text-opacity-slider-label"
            style={{
              backgroundColor: changeAlpha(bubbleBg, 0.8),
              borderRadius: 25,
              height: '150px',
              marginTop: 2,
              padding: 8,
              position: 'absolute',
              top: 48,
              zIndex: 100,
            }}
          >
            <Slider
              orientation="vertical"
              min={0}
              max={100}
              value={opacity * 100}
              getAriaValueText={(value) => t('opacityCurrentValue', { value })}
              onChange={(evt, val) => updateWindowTextOverlayOptions({
                ...windowTextOverlayOptions,
                opacity: val / 100.0,
              })}
            />
          </div>
          )}
        </div>
      </>
      )}
      {textsFetching
        && <CircularProgress disableShrink size={50} style={{ position: 'absolute' }} />}
      <MiradorMenuButton
        aria-label={open ? t('collapseTextOverlayOptions') : t('expandTextOverlayOptions')}
        disabled={textsFetching}
        onClick={() => setOpen(!open)}
      >
        { (open && !textsFetching)
          ? <CloseIcon />
          : <SubjectIcon />}
      </MiradorMenuButton>
    </div>
  );
};

TextOverlaySettingsBubble.propTypes = {
  imageToolsEnabled: PropTypes.bool.isRequired,
  t: PropTypes.func.isRequired,
  textsAvailable: PropTypes.bool.isRequired,
  textsFetching: PropTypes.bool.isRequired,
  updateWindowTextOverlayOptions: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  windowTextOverlayOptions: PropTypes.object.isRequired,
};

export default TextOverlaySettingsBubble;
