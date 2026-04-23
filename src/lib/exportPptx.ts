import pptxgen from 'pptxgenjs';

export interface PptxSlide {
  title: string;
  body?: string;
  /** Image URLs (up to the first 3 are rendered). */
  images?: string[];
}

export const exportToPptx = async (
  title: string,
  slides: PptxSlide[],
  filename: string,
): Promise<void> => {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = title;

  const cover = pptx.addSlide();
  cover.addText(title, {
    x: 0.5,
    y: 2.5,
    w: 12,
    h: 1,
    fontSize: 36,
    bold: true,
    color: '2563EB',
    align: 'center',
  });
  cover.addText(new Date().toLocaleString(), {
    x: 0.5,
    y: 3.8,
    w: 12,
    h: 0.5,
    fontSize: 14,
    align: 'center',
    color: '666666',
  });

  for (const s of slides) {
    const slide = pptx.addSlide();
    slide.addText(s.title, {
      x: 0.5,
      y: 0.3,
      w: 12,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: '1E293B',
    });
    if (s.body) {
      slide.addText(s.body, {
        x: 0.5,
        y: 1.0,
        w: 12,
        h: 1.5,
        fontSize: 12,
        color: '475569',
      });
    }
    if (s.images?.length) {
      const cols = Math.min(s.images.length, 3);
      const w = 11 / cols;
      s.images.slice(0, 3).forEach((src, i) => {
        try {
          slide.addImage({
            path: src,
            x: 0.5 + i * w,
            y: 2.8,
            w: w - 0.2,
            h: 3.5,
          });
        } catch {
          /* ignore unreachable/invalid images */
        }
      });
    }
  }

  await pptx.writeFile({ fileName: filename });
};
