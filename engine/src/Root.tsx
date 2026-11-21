import React from 'react';
import {Composition} from 'remotion';
import {Film} from './Film';
import {DURATION, FPS} from './engine';
import {FRAME_W, FRAME_H} from './format';
import {CastSheet, ExprSheet, PropSheet, SetPlate, SubjectSheet} from './design/Sheets';

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={Math.max(1, Math.round(DURATION * FPS))} fps={FPS} width={FRAME_W} height={FRAME_H} />
    <Composition id="CastSheet" component={CastSheet} durationInFrames={1} fps={FPS} width={2000} height={2300} defaultProps={{which: 'episode' as const, page: 0}} />
    <Composition id="ExprSheet" component={ExprSheet} durationInFrames={1} fps={FPS} width={2000} height={2600} defaultProps={{look: 'ex_baHanh'}} />
    <Composition id="SetPlate" component={SetPlate} durationInFrames={1} fps={FPS} width={FRAME_W} height={FRAME_H} defaultProps={{id: 'ex-lobby', grid: false}} />
    <Composition id="PropSheet" component={PropSheet} durationInFrames={1} fps={FPS} width={2400} height={2600} defaultProps={{page: 0, sizes: {}}} />
    <Composition id="SubjectSheet" component={SubjectSheet} durationInFrames={1} fps={FPS} width={2400} height={2400} defaultProps={{id: '', sizes: {}}} />
  </>
);
