window.WikiAssets = {
  bindEditor({ textarea, onInsert, getPageTitle, onError }) {
    if (!textarea) return;

    const insertImageFile = async (file) => {
      try {
        const asset = await WikiStorage.saveAssetFromFile(file, getPageTitle ? getPageTitle() : 'image');
        onInsert(asset.embed);
      } catch (e) {
        if (onError) onError(e.message || 'Failed to insert image');
      }
    };

    textarea.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
      for (const file of files) await insertImageFile(file);
    });

    textarea.addEventListener('dragover', (e) => e.preventDefault());

    textarea.addEventListener('paste', async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find(i => i.type && i.type.startsWith('image/'));
      if (!imgItem) return;
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (file) await insertImageFile(file);
    });

    return async function pickAndInsert() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.click();
      await new Promise(resolve => {
        input.addEventListener('change', resolve, { once: true });
      });
      if (!input.files?.[0]) return;
      await insertImageFile(input.files[0]);
    };
  },
};
