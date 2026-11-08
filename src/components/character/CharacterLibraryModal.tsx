import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, X, Upload } from 'lucide-react';
import { CharacterRecord } from '../../types/queue';
import { saveCharacter, getProjectCharacters, deleteCharacter } from '../../services/characterManager';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface CharacterLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onCharactersUpdated?: () => void;
}

export const CharacterLibraryModal: React.FC<CharacterLibraryModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onCharactersUpdated,
}) => {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);

  // New character form state
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [description, setDescription] = useState('');
  const [wardrobe, setWardrobe] = useState('');
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showToast } = useToast();

  const loadCharacters = async () => {
    try {
      const chars = await getProjectCharacters(projectId);
      setCharacters(chars);

      const urls: Record<string, string> = {};
      chars.forEach((c) => {
        if (c.portraitBlob) {
          urls[c.id] = URL.createObjectURL(c.portraitBlob);
        }
      });
      setThumbUrls(urls);
    } catch (err) {
      console.error('Failed to load characters:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCharacters();
    }
    return () => {
      Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [isOpen, projectId]);

  const handlePortraitSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPortraitFile(file);
      setPortraitPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Character name is required.', 'error');
      return;
    }
    if (!portraitFile) {
      showToast('Please upload an approved reference portrait.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const aliasArray = aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      await saveCharacter(projectId, name, portraitFile, {
        aliases: aliasArray.length > 0 ? aliasArray : [name.trim()],
        description,
        wardrobe,
      });

      showToast(`Added ${name} to Character Library`, 'success');
      // Reset form
      setName('');
      setAliases('');
      setDescription('');
      setWardrobe('');
      setPortraitFile(null);
      setPortraitPreview(null);
      setShowAddForm(false);
      await loadCharacters();
      onCharactersUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Error saving character', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (charId: string, charName: string) => {
    if (window.confirm(`Remove ${charName} from project reference library? Existing generated outputs are preserved.`)) {
      await deleteCharacter(charId);
      showToast(`Removed ${charName}`, 'info');
      await loadCharacters();
      onCharactersUpdated?.();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-300" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Character Reference Library</h3>
              <p className="text-xs text-zinc-400">
                Upload character portraits once and reuse them consistently across all scenes.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
          {/* Top Bar: Add Button */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">
              {characters.length} Registered Character{characters.length !== 1 ? 's' : ''}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              {showAddForm ? 'Cancel Form' : 'Add New Character'}
            </Button>
          </div>

          {/* Add Character Form */}
          {showAddForm && (
            <form onSubmit={handleSaveCharacter} className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-zinc-200">Register Character Portrait</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-zinc-400">Character Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rafael"
                    className="bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-zinc-400">Aliases (Comma separated)</label>
                  <input
                    type="text"
                    value={aliases}
                    onChange={(e) => setAliases(e.target.value)}
                    placeholder="e.g. Rafael Santos, Raffy"
                    className="bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-zinc-400">Appearance / Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. 30s Filipino protagonist, sharp jaw, short hair"
                    className="bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-zinc-400">Standard Wardrobe</label>
                  <input
                    type="text"
                    value={wardrobe}
                    onChange={(e) => setWardrobe(e.target.value)}
                    placeholder="e.g. Dark charcoal barong or dark jacket"
                    className="bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              {/* Portrait Upload */}
              <div className="flex items-center gap-3 pt-1">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Approved Portrait</span>
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePortraitSelect} />
                </label>

                {portraitPreview && (
                  <div className="flex items-center gap-2">
                    <img src={portraitPreview} alt="Preview" className="w-8 h-10 object-cover rounded border border-zinc-700" />
                    <span className="text-xs text-zinc-400 truncate max-w-xs">{portraitFile?.name}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Character'}
                </Button>
              </div>
            </form>
          )}

          {/* Character Grid */}
          {characters.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-lg flex flex-col items-center gap-2">
              <Users className="w-8 h-8 text-zinc-600" />
              <p className="text-xs font-medium text-zinc-400">No characters registered yet.</p>
              <p className="text-[11px] text-zinc-500">
                Click "Add New Character" to upload your approved reference portraits (e.g. Rafael, Mariel, Carlo).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {characters.map((char) => {
                const thumbUrl = thumbUrls[char.id];
                return (
                  <div
                    key={char.id}
                    className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 flex flex-col gap-2 transition-colors group"
                  >
                    <div className="flex items-start gap-2.5">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={char.name}
                          className="w-12 h-16 object-cover rounded border border-zinc-800 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-500 shrink-0">
                          {char.name.charAt(0)}
                        </div>
                      )}

                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-100 truncate">{char.name}</span>
                          <button
                            onClick={() => handleDelete(char.id, char.name)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity"
                            title="Delete Character"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {char.aliases?.length > 1 && (
                          <span className="text-[10px] text-zinc-500 truncate">
                            {char.aliases.join(', ')}
                          </span>
                        )}

                        {char.description && (
                          <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                            {char.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {char.wardrobe && (
                      <div className="text-[10px] text-zinc-500 bg-zinc-900/60 px-2 py-0.5 rounded truncate">
                        <span className="text-zinc-400 font-medium">Wardrobe: </span>
                        {char.wardrobe}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/80">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Library
          </Button>
        </div>
      </div>
    </div>
  );
};
