import { finiteStyleFixture } from './finite-style-fixture';

// Independently authored values cover every finite token emitted by AVA's EPUB writer.
const CSS = `.block{font-family:monospace;text-align:start;font-size:1.5em;
font-weight:400;font-style:normal;font-variant:normal;vertical-align:baseline;
text-indent:0em;margin-inline-start:1.2em;margin-top:0em;margin-bottom:.4em;
line-height:1.25;color:#112233;background-color:#fff;
text-decoration-line:underline line-through;text-decoration-color:#223344;}
.small{font-size:.8em;font-style:italic;line-height:1.1;} .reset{font-size:1em;
font-style:normal;text-decoration-line:none;}`;

describe('ordinary reimport of finite canonical style declarations', () => {
  it('retains all block tokens and keeps inline relative size separate', async () => {
    const result = await finiteStyleFixture(
      CSS,
      '<p id="styled" class="block">Body <span class="small">small</span> <span class="reset">reset</span>.</p>',
    );
    const block = result.chapters[0].blocks[0];
    expect(block).toMatchObject({
      fontSizeScale: 1.5,
      fontWeight: 400,
      textIndent: 0,
      presentation: {
        family: 'monospace',
        align: 'start',
        relative_size: 1.5,
        italic: false,
        small_caps: false,
        vertical_align: 'baseline',
        indent_em: 0,
        block_indent_em: 1.2,
        space_before_em: 0,
        space_after_em: 0.4,
        line_height: 1.25,
        color: '#112233',
        background_color: '#ffffff',
        decoration_color: '#223344',
        underline: true,
        strike_through: true,
      },
    });
    if (!('inlines' in block)) throw new Error('Missing authored paragraph');
    const text = block.inlines.filter((inline) => inline.kind === 'text');
    expect(text.find((run) => run.text === 'small')).toMatchObject({
      presentation: { relative_size: 0.8, italic: true, line_height: 1.1 },
    });
    expect(text.find((run) => run.text === 'reset')).toMatchObject({
      presentation: {
        relative_size: 1,
        italic: false,
        underline: false,
        strike_through: false,
      },
    });
    expect(text[0].presentation?.relative_size).toBeUndefined();
    expect(text[0].presentation?.space_before_em).toBeUndefined();
    expect(block.text).toBe('Body small reset.');
  });
  it('accumulates nested inline factors without double applying block size', async () => {
    const result = await finiteStyleFixture(
      '.large{font-size:2em}.small{font-size:.8em}.half{font-size:.5em}',
      '<p class="large"><span class="small">Small <span class="half">nested</span> tail</span> body</p>',
    );
    const block = result.chapters[0].blocks[0];
    if (!('inlines' in block)) throw new Error('Missing paragraph');
    expect(
      block.inlines.find((run) => run.kind === 'text' && run.text === 'nested'),
    ).toMatchObject({ presentation: { relative_size: 0.4 } });
    expect(
      block.inlines.find((run) => run.kind === 'text' && run.text === 'Small '),
    ).toMatchObject({ presentation: { relative_size: 0.8 } });
  });
});
