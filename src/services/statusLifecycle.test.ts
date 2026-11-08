import { describe, it, expect } from 'vitest';
import { QueueItem } from '../types/queue';

describe('status lifecycle and decoupling', () => {
  it('strictly decouples copied from submitted and enforces user confirmation', () => {
    // Initial scene
    const scene: QueueItem = {
      id: 'Proj_Ep01_P01_Sc68AD',
      projectTitle: 'Proj',
      episode: '01',
      part: '01',
      scene: '68AD',
      rawJsonText: '{"scene": "68AD"}',
      metadata: {},
      extractedReferences: [],
      validationIssues: [],
      status: 'queued',
      currentAttemptNumber: 0,
      attempts: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(scene.status).toBe('queued');

    // Action 1: User copies prompt JSON
    const copiedScene: QueueItem = {
      ...scene,
      status: 'copied',
      updatedAt: Date.now(),
    };
    expect(copiedScene.status).toBe('copied');
    // Ensure it is NOT automatically marked as submitted
    expect(copiedScene.status).not.toBe('submitted');

    // Action 2: User explicitly confirms submission in ChatGPT
    const submittedScene: QueueItem = {
      ...copiedScene,
      status: 'submitted',
      updatedAt: Date.now(),
    };
    expect(submittedScene.status).toBe('submitted');

    // Action 3: Result image dropped -> Awaiting Review
    const awaitingReviewScene: QueueItem = {
      ...submittedScene,
      status: 'awaiting_review',
      currentAttemptNumber: 1,
      attempts: [
        {
          id: 'att_1',
          sceneId: scene.id,
          attemptNumber: 1,
          timestamp: Date.now(),
          status: 'awaiting_review',
          imageBlobId: 'blob_1',
          imageExtension: 'png',
        },
      ],
      updatedAt: Date.now(),
    };
    expect(awaitingReviewScene.status).toBe('awaiting_review');
    expect(awaitingReviewScene.attempts).toHaveLength(1);

    // Action 4: User marks Regeneration Required with feedback
    const regenScene: QueueItem = {
      ...awaitingReviewScene,
      status: 'regeneration_required',
      attempts: [
        {
          ...awaitingReviewScene.attempts[0],
          status: 'rejected',
          notes: 'Cooke bokeh needs more anamorphic flare',
        },
      ],
      updatedAt: Date.now(),
    };
    expect(regenScene.status).toBe('regeneration_required');
    expect(regenScene.attempts[0].status).toBe('rejected');
    expect(regenScene.attempts[0].notes).toBe('Cooke bokeh needs more anamorphic flare');

    // Action 5: Second attempt dropped and Approved
    const approvedScene: QueueItem = {
      ...regenScene,
      status: 'approved',
      currentAttemptNumber: 2,
      attempts: [
        regenScene.attempts[0], // Attempt 1 is preserved intact!
        {
          id: 'att_2',
          sceneId: scene.id,
          attemptNumber: 2,
          timestamp: Date.now(),
          status: 'approved',
          imageBlobId: 'blob_2',
          imageExtension: 'webp',
        },
      ],
      updatedAt: Date.now(),
    };
    expect(approvedScene.status).toBe('approved');
    expect(approvedScene.attempts).toHaveLength(2);
    expect(approvedScene.attempts[0].status).toBe('rejected');
    expect(approvedScene.attempts[1].status).toBe('approved');
  });
});
