/**
 * Утилиты для оптимизации и сжатия прикрепляемых изображений (чеков, фото квитанций)
 * перед сохранением в локальное хранилище IndexedDB.
 */

export async function processAndCompressImage(file: File, maxDimension = 1200, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      reject(new Error('Пожалуйста, выберите файл изображения (JPG, PNG, WebP, HEIC).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл изображения.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ошибка декодирования изображения.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Масштабирование с сохранением пропорций
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Фолбэк на оригинальный Data URL, если canvas недоступен
          resolve(e.target?.result as string);
          return;
        }

        // Рисуем на белом фоне (для прозрачных PNG, чтобы не чернели)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Пробуем WebP, затем fallback на JPEG
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData && webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch (_) {
          // Игнорируем и используем JPEG
        }

        const jpegData = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegData);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Подсчет примерного размера base64 строки в килобайтах
 */
export function getBase64SizeInKB(base64String: string): string {
  if (!base64String) return '0 KB';
  const stringLength = base64String.length - (base64String.indexOf(',') + 1);
  const sizeInBytes = (stringLength * 3) / 4;
  const sizeInKB = sizeInBytes / 1024;
  if (sizeInKB > 1024) {
    return `${(sizeInKB / 1024).toFixed(1)} MB`;
  }
  return `${Math.round(sizeInKB)} KB`;
}
