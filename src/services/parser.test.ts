import { describe, it, expect } from 'vitest';
import {
  parseImagePromptJson,
  compareSceneNumbers,
  validatePromptMetadata,
  buildCompositeSceneId,
} from './parser';

describe('parser service', () => {
  it('parses user specific cinematic Image Prompt JSON format and preserves verbatim raw text', () => {
    const rawSample = `{
  "image_number": 42,
  "episode": 1,
  "part": 2,
  "scene": "68AD",
  "title": "Dramatic Confrontation in Intramuros",
  "duration_seconds": 4.5,
  "aspect_ratio": "9:16",
  "resolution": "1080x1920",
  "production": "ARRI ALEXA 35, Cooke S4/i lenses, 35mm T2.0, premium photorealistic Filipino cinema",
  "reference_images": [
    "Char_Mateo_Portrait.png",
    "Loc_Int_SanAgustin_Courtyard.jpg"
  ],
  "location": "San Agustin Church Courtyard, Intramuros, Manila",
  "exact_character_count": 1,
  "characters_visible": ["Mateo Santos"],
  "prompt": "Cinematic vertical portrait shot of Mateo Santos standing in the shadows of the stone corridor..."
}`;

    const parsed = parseImagePromptJson(rawSample, 'SampleTest.json');
    expect(parsed).toHaveLength(1);
    const scene = parsed[0];

    // Check verbatim text
    expect(scene.rawJsonText).toBe(rawSample);

    // Check alphanumeric scene identification
    expect(scene.metadata.scene).toBe('68AD');
    expect(scene.id).toBe('SampleTest_Ep1_P2_Sc68AD');

    // Check extracted references
    expect(scene.extractedReferences).toHaveLength(2);
    expect(scene.extractedReferences[0].filename).toBe('Char_Mateo_Portrait.png');
    expect(scene.extractedReferences[0].category).toBe('character');
    expect(scene.extractedReferences[1].filename).toBe('Loc_Int_SanAgustin_Courtyard.jpg');
    expect(scene.extractedReferences[1].category).toBe('location');

    // Check validation issues (should have zero aspect ratio warnings)
    const aspectWarning = scene.validationIssues.find((i) => i.field === 'aspect_ratio');
    expect(aspectWarning).toBeUndefined();
  });

  it('correctly sorts alphanumeric scene IDs (1, 2, 2A, 2B, 10, 68A, 68AD, 70)', () => {
    const scenes = ['70', '68AD', '2B', '1', '68A', '10', '2', '2A'];
    const sorted = [...scenes].sort(compareSceneNumbers);
    expect(sorted).toEqual(['1', '2', '2A', '2B', '10', '68A', '68AD', '70']);
  });

  it('detects and flags cinematic format discrepancies as non-blocking warnings', () => {
    const nonCinematicSample = {
      project_title: 'TestProject',
      episode: '01',
      part: '01',
      scene: '20B',
      aspect_ratio: '16:9', // Wrong aspect ratio
      resolution: '3840x2160', // Wrong resolution
      camera_setup: 'Generic DSLR 50mm', // Missing ARRI & Cooke
      exact_character_count: 2,
      characters_visible: ['Character 1'], // Count mismatch: 2 vs 1
    };

    const issues = validatePromptMetadata(nonCinematicSample);
    const issueFields = issues.map((i) => i.field);

    expect(issueFields).toContain('aspect_ratio');
    expect(issueFields).toContain('resolution');
    expect(issueFields).toContain('camera_setup');
    expect(issueFields).toContain('characters_visible');
  });

  it('parses batch JSON array containing multiple alphanumeric scenes', () => {
    const batchJson = JSON.stringify([
      { episode: '01', part: '01', scene: '68A', title: 'Scene A' },
      { episode: '01', part: '01', scene: '68AD', title: 'Scene AD' },
      { episode: '01', part: '01', scene: '20B', title: 'Scene B' },
    ]);

    const parsed = parseImagePromptJson(batchJson, 'BatchTest.json');
    expect(parsed).toHaveLength(3);
    expect(parsed.map((p) => p.metadata.scene)).toEqual(['68A', '68AD', '20B']);
  });

  it('builds collision-proof composite IDs', () => {
    const id1 = buildCompositeSceneId('Filipino Epics', 1, 1, '68A');
    const id2 = buildCompositeSceneId('Filipino Epics', 1, 1, '68AD');
    expect(id1).not.toBe(id2);
    expect(id1).toBe('Filipino_Epics_Ep1_P1_Sc68A');
    expect(id2).toBe('Filipino_Epics_Ep1_P1_Sc68AD');
  });

  it('handles UTF-8 BOM smoothly without JSON syntax errors', () => {
    const rawWithBOM = '\uFEFF{"scene": "68AD", "title": "BOM Test"}';
    const parsed = parseImagePromptJson(rawWithBOM);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].metadata.scene).toBe('68AD');
  });

  it('strips markdown code block wrappers (```json ... ```)', () => {
    const rawMarkdown = '```json\n{"scene": "68AD", "title": "Markdown Wrap Test"}\n```';
    const parsed = parseImagePromptJson(rawMarkdown);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].metadata.scene).toBe('68AD');
    expect(parsed[0].metadata.title).toBe('Markdown Wrap Test');
  });

  it('gracefully accepts plain text prompt input and generates a 9:16 scene prompt object', () => {
    const plainText = 'Cinematic vertical portrait shot of Mateo in rain at dawn';
    const parsed = parseImagePromptJson(plainText);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].metadata.prompt).toBe(plainText);
    expect(parsed[0].metadata.aspect_ratio).toBe('9:16');
  });
});
