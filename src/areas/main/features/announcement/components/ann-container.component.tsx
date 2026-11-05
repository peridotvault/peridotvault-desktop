import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbTack } from '@fortawesome/free-solid-svg-icons';
import type { GameAnnouncementType } from '@shared/interfaces/game';
import { ImageLoading } from '@shared/constants/images';

interface AnnouncementContainerProps {
  item: GameAnnouncementType;
  onClick?: () => void;
}

export const AnnouncementContainer = ({ item, onClick }: AnnouncementContainerProps) => {
  const cover =
    typeof item.coverImage === 'string' && item.coverImage ? item.coverImage : ImageLoading;
  const createdAtNs =
    typeof item.createdAt === 'bigint'
      ? Number(item.createdAt) / 1_000_000
      : typeof item.createdAt === 'number'
        ? item.createdAt
        : undefined;
  const createdAt = createdAtNs ? new Date(createdAtNs).toLocaleDateString() : '';

  return (
    <section
      onClick={onClick}
      className="p-6 shadow-arise-sm hover:shadow-sunken-sm rounded-2xl flex gap-6 cursor-pointer transition-shadow"
    >
      <img
        src={cover}
        alt={item.headline ?? 'Announcement'}
        className="w-[300px] aspect-video shadow-sunken-sm object-cover rounded-xl"
      />

      <div className="gap-2 flex flex-col">
        <p className="text-text_disabled text-base">{createdAt}</p>
        <div className="flex items-center gap-2">
          {item.pinned ? <FontAwesomeIcon icon={faThumbTack} className="text-sm" /> : null}
          <h3 className="line-clamp-2 text-xl ">{item.headline}</h3>
        </div>
        <p className="line-clamp-4 text-text_disabled">{item.content}</p>
      </div>
    </section>
  );
};
