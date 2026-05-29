// ASCII conversion adapted from https://github.com/mwpryer/ascii-ify
// (pixel-sampling + ITU-R BT.709 luminance + character mapping). Adds the
// brightness/contrast adjustment step from the upstream so the UI can wire
// them to sliders.

export const DEFAULT_CHARS = "█▓▒░ "; // █▓▒░ (shades)

export interface AsciiOptions {
    width: number; // output columns
    height: number; // output rows
    chars?: string; // ramp from dense (left) to sparse (right)
    contrast?: number; // 1 = unchanged
    brightness?: number; // 0 = unchanged, range typically -1..1
}

function adjustPixel(
    value: number,
    contrast: number,
    brightness: number,
): number {
    let adjusted = ((value / 255 - 0.5) * contrast + 0.5) * 255;
    adjusted += brightness * 255;
    return Math.max(0, Math.min(255, adjusted));
}

// Convert raw pixel data to a multi-line ASCII string. Exported so callers
// can pre-decode an image once and re-render cheaply on slider changes.
export function imageDataToAscii(data: ImageData, opts: AsciiOptions): string {
    const {
        width: outW,
        height: outH,
        chars = DEFAULT_CHARS,
        contrast = 1,
        brightness = 0,
    } = opts;
    const { width: srcW, height: srcH, data: pixels } = data;

    const sampleW = srcW / outW;
    const sampleH = srcH / outH;
    const charsArr = chars.split("").reverse(); // map bright → dense

    const lines: string[] = [];
    for (let row = 0; row < outH; row++) {
        let line = "";
        for (let col = 0; col < outW; col++) {
            const step = Math.max(
                1,
                Math.floor(Math.min(sampleW, sampleH) / 4),
            );
            const x0 = Math.floor(col * sampleW);
            const y0 = Math.floor(row * sampleH);
            let r = 0,
                g = 0,
                b = 0,
                count = 0;
            for (let dy = 0; dy < sampleH; dy += step) {
                for (let dx = 0; dx < sampleW; dx += step) {
                    const px = Math.min(Math.floor(x0 + dx), srcW - 1);
                    const py = Math.min(Math.floor(y0 + dy), srcH - 1);
                    const i = (py * srcW + px) * 4;
                    r += pixels[i];
                    g += pixels[i + 1];
                    b += pixels[i + 2];
                    count++;
                }
            }
            if (count > 0) {
                r = adjustPixel(r / count, contrast, brightness);
                g = adjustPixel(g / count, contrast, brightness);
                b = adjustPixel(b / count, contrast, brightness);
            }
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const idx = Math.round((lum / 255) * (charsArr.length - 1));
            line += charsArr[idx] ?? " ";
        }
        lines.push(line);
    }
    return lines.join("\n");
}

// Decode a Blob to ImageData once, so callers can cache it and re-render
// instantly when settings change.
export async function blobToImageData(blob: Blob): Promise<ImageData> {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not get 2D canvas context");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Convenience: full decode-and-convert in one call.
export async function blobToAscii(
    blob: Blob,
    opts: AsciiOptions,
): Promise<string> {
    const data = await blobToImageData(blob);
    return imageDataToAscii(data, opts);
}

// For the live webcam loop: the caller draws each video frame into a canvas
// (typically a downscaled one for perf), then asks us to render it.
export function canvasToAscii(
    canvas: HTMLCanvasElement,
    opts: AsciiOptions,
): string {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not get 2D canvas context");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageDataToAscii(data, opts);
}
