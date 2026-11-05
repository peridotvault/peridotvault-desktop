import { ButtonWithSound } from '@shared/components/ui/ButtonWithSound';
import { ImageLoading } from '@shared/constants/images';

interface LibrarySidebarItemEntry {
  gameId: string;
  gameName: string;
  coverVerticalImage?: string;
  bannerImage?: string;
}

interface LibrarySidebarItemProps {
  entry: LibrarySidebarItemEntry;
  isActive: boolean;
  onClick: () => void;
}

export const LibrarySidebarItem: React.FC<LibrarySidebarItemProps> = ({
  entry,
  isActive,
  onClick,
}) => {
  // pilih cover: vertical > banner
  const coverUrl = entry.coverVerticalImage || entry.bannerImage || ImageLoading;

  return (
    <ButtonWithSound
      key={entry.gameId}
      onClick={onClick}
      className={`flex duration-300 relative group active:-translate-y-1 hover:cursor-pointer
        ${isActive ? 'bg-linear-to-l from-accent-foreground/40 via-accent-foreground/10' : ''}`}
    >
      <div className="flex items-center gap-3 py-2">
        <img src={coverUrl} className="w-7 h-7 object-cover rounded" alt={entry.gameName} />
        <p className="truncate text-sm">{entry.gameName}</p>
      </div>

      <div
        className={`absolute right-0 top-1/2 -translate-y-1/2 w-[3px] rounded-l-full bg-accent-foreground transition-all duration-200 ${
          isActive ? 'h-4/5 opacity-100' : 'h-0 opacity-0 group-hover:h-1/3 group-hover:opacity-100'
        }`}
      />
    </ButtonWithSound>
  );
};
