import script from '../script.json';

export const FORMAT: '9:16' | '16:9' = (script as Record<string, unknown>)?.format === '16:9' ? '16:9' : '9:16';
export const FRAME_W = FORMAT === '16:9' ? 1920 : 1080;
export const FRAME_H = FORMAT === '16:9' ? 1080 : 1920;
export const CAPTION_Y = FORMAT === '16:9' ? 940 : 1640;
export const CAPTION_BAND: [number, number] = FORMAT === '16:9' ? [880, 1000] : [1570, 1710];
