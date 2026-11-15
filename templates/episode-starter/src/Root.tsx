import React from 'react';
import {Composition} from 'remotion';
import {Film} from './Film';
import {DURATION, FPS} from './engine';
import {CastSheet, ExprSheet, SetPlate} from './design/Sheets';

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={Math.max(1, Math.round(DURATION * FPS))} fps={FPS} width={1080} height={1920} />
    <Composition id="CastSheet" component={CastSheet} durationInFrames={1} fps={FPS} width={2000} height={2300} defaultProps={{which: 'episode' as const, page: 0}} />
    <Composition id="ExprSheet" component={ExprSheet} durationInFrames={1} fps={FPS} width={2000} height={2400} defaultProps={{look: 'ex_baHanh'}} />
    <Composition id="SetPlate" component={SetPlate} durationInFrames={1} fps={FPS} width={1080} height={1920} defaultProps={{id: 'ex-lobby', grid: false}} />
  </>
);
