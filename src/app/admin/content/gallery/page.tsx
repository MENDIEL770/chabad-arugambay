import { getGallery, getAlbums } from '@/lib/data/gallery';
import { GalleryManager } from '@/components/admin/gallery-manager';

export const dynamic = 'force-dynamic';

export default async function GalleryAdminPage() {
  const [items, albums] = await Promise.all([getGallery(), getAlbums()]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">גלריה</h1>
        <p className="mt-1 max-w-[68ch] text-sm text-fg-muted">
          תמונות וסרטונים מהבית. מה שמסומן לעמוד הראשי מופיע ברצועה שם;
          השאר בעמוד הגלריה, מסודר לפי אלבומים.
        </p>
      </div>
      <GalleryManager items={items} albums={albums} />
    </div>
  );
}
