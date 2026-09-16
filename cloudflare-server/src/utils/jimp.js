import { createJimp } from '@jimp/core';
import jpeg from '@jimp/js-jpeg';
import png from '@jimp/js-png';
import bmp from '@jimp/js-bmp';
import * as resize from '@jimp/plugin-resize';
import * as crop from '@jimp/plugin-crop';

export const Jimp = createJimp({
  formats: [jpeg, png, bmp],
  plugins: [resize.methods, crop.methods],
});
