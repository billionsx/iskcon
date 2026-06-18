/**
 * personaGallery — кураторские галереи обложек личностей (юнит-стандарт ВКЛ/ПКЛ).
 *
 * Ключ — id сущности (как в /api/entities/:id). Значение — упорядоченный список
 * изображений; первое = главная обложка. Используется PersonHeroCard как
 * слайдер с авто-сменой раз в 3 секунды (см. CardCover). Если для личности
 * галереи нет — карточка показывает одиночное фото из data.image.
 */
export const PERSONA_GALLERY: Record<string, string[]> = {
  // Шри Кришна — Верховная Личность Бога. Главная обложка: krishna-0026.
  krishna: [
    "/media/personalities/krishna/krishna-0026.jpg",
    "/media/personalities/krishna/krishna-001.jpg",
    "/media/personalities/krishna/krishna-002.jpg",
    "/media/personalities/krishna/krishna-003.jpg",
    "/media/personalities/krishna/krishna-004.jpg",
    "/media/personalities/krishna/krishna-005.jpg",
    "/media/personalities/krishna/krishna-006.jpg",
    "/media/personalities/krishna/krishna-007.jpg",
    "/media/personalities/krishna/krishna-008.jpg",
    "/media/personalities/krishna/krishna-009.jpg",
    "/media/personalities/krishna/krishna-0010.jpg",
    "/media/personalities/krishna/krishna-0011.jpg",
    "/media/personalities/krishna/krishna-0012.jpg",
    "/media/personalities/krishna/krishna-0013.jpg",
    "/media/personalities/krishna/krishna-0014.jpg",
    "/media/personalities/krishna/krishna-0015.jpg",
    "/media/personalities/krishna/krishna-0016.jpg",
    "/media/personalities/krishna/krishna-0017.jpg",
    "/media/personalities/krishna/krishna-0018.jpg",
    "/media/personalities/krishna/krishna-0019.jpg",
    "/media/personalities/krishna/krishna-0020.jpg",
    "/media/personalities/krishna/krishna-0021.jpg",
    "/media/personalities/krishna/krishna-0022.jpg",
    "/media/personalities/krishna/krishna-0023.jpg",
    "/media/personalities/krishna/krishna-0024.jpg",
    "/media/personalities/krishna/krishna-0025.jpg",
    "/media/personalities/krishna/krishna-0027.jpg",
    "/media/personalities/krishna/krishna-0028.jpg",
    "/media/personalities/krishna/krishna-0029.jpg",
  ],
};

/** Галерея обложек личности: кураторский список или одиночное фото из реестра. */
export function galleryFor(id: string, fallbackImage?: string | null): string[] {
  const g = PERSONA_GALLERY[id];
  if (g && g.length) return g;
  return fallbackImage ? [fallbackImage] : [];
}
