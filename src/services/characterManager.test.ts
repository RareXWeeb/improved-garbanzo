import { describe, it, expect } from 'vitest';
import {
  buildCharacterId,
  autoMatchCharactersForScene,
  validateCharacterSelection,
} from './characterManager';
import { CharacterRecord, QueueItem } from '../types/queue';

describe('characterManager', () => {
  describe('buildCharacterId', () => {
    it('creates standardized slugs from project ID and character name', () => {
      const id = buildCharacterId('proj_ang_pagbabalik', 'Rafael Santos');
      expect(id).toBe('char_proj_ang_pagbabalik_rafael_santos');
    });

    it('strips special characters and trims whitespace', () => {
      const id = buildCharacterId('proj_1', '  Mariel (Young)!  ');
      expect(id).toBe('char_proj_1_mariel_young');
    });
  });

  describe('autoMatchCharactersForScene', () => {
    const mockCharacters: CharacterRecord[] = [
      {
        id: 'char_rafael',
        projectId: 'proj_1',
        name: 'Rafael',
        aliases: ['Rafael Santos', 'Raffy', 'Rafael_Ref.png'],
        portraitBlob: new Blob(['fake']),
        portraitMimeType: 'image/png',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'char_mariel',
        projectId: 'proj_1',
        name: 'Mariel',
        aliases: ['Mariel Reyes'],
        portraitBlob: new Blob(['fake']),
        portraitMimeType: 'image/png',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    it('matches characters by characters_visible array', () => {
      const scene: Partial<QueueItem> = {
        metadata: {
          characters_visible: ['Rafael', 'Extra Person'],
          reference_images: [],
        },
      };

      const matched = autoMatchCharactersForScene(scene as QueueItem, mockCharacters);
      expect(matched).toContain('char_rafael');
      expect(matched).not.toContain('char_mariel');
    });

    it('matches characters by reference_images filename hint', () => {
      const scene: Partial<QueueItem> = {
        metadata: {
          characters_visible: [],
          reference_images: ['Rafael_Ref.png', 'location_livingroom.png'],
        },
      };

      const matched = autoMatchCharactersForScene(scene as QueueItem, mockCharacters);
      expect(matched).toContain('char_rafael');
      expect(matched).not.toContain('char_mariel');
    });

    it('matches characters case-insensitively with alias support', () => {
      const scene: Partial<QueueItem> = {
        metadata: {
          characters_visible: ['mariel reyes'],
          reference_images: [],
        },
      };

      const matched = autoMatchCharactersForScene(scene as QueueItem, mockCharacters);
      expect(matched).toContain('char_mariel');
    });
  });

  describe('validateCharacterSelection', () => {
    it('reports valid when exact_character_count matches selected count', () => {
      const scene: Partial<QueueItem> = {
        metadata: {
          exact_character_count: 2,
        },
        selectedCharacterIds: ['char_1', 'char_2'],
      };

      const validation = validateCharacterSelection(scene as QueueItem);
      expect(validation.isValid).toBe(true);
      expect(validation.warning).toBeUndefined();
    });

    it('flags mismatch warning when selected character count differs', () => {
      const scene: Partial<QueueItem> = {
        metadata: {
          exact_character_count: 2,
        },
        selectedCharacterIds: ['char_1'],
      };

      const validation = validateCharacterSelection(scene as QueueItem);
      expect(validation.isValid).toBe(false);
      expect(validation.warning).toContain('requires exactly 2 character(s)');
    });

    it('allows 0 characters when exact_character_count is 0', () => {
      const scene: Partial<QueueItem> = {
        metadata: {
          exact_character_count: 0,
        },
        selectedCharacterIds: [],
      };

      const validation = validateCharacterSelection(scene as QueueItem);
      expect(validation.isValid).toBe(true);
    });
  });
});
