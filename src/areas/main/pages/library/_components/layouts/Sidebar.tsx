import { useMemo, useState } from 'react';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLocation, useNavigate } from 'react-router-dom';
import { LibrarySidebarItem } from '@main/features/library/components/SidebarItem';
import { useMyGames } from '@main/features/library/hooks/useMyGames';
import { formatTitle } from '@main/features/library/utils/formatTitle';

export const LibrarySidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { games, loading } = useMyGames();
  const [searchQuery] = useState('');

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return games;
    return games.filter((game) => game.name.toLowerCase().includes(q));
  }, [games, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-card w-[250px] z-10 border-r border-foreground/5 shadow-2xl">
      <div className="py-6 px-5 flex justify-between items-center ">
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <FontAwesomeIcon icon={faMagnifyingGlass} className="text-muted-foreground/50 text-lg hover:text-foreground cursor-pointer transition-colors" />
      </div>

      {!loading && !filteredGames.length && (
        <p className="text-xs text-muted-foreground/60 px-5 py-2 italic">Your library is empty.</p>
      )}

      {loading && filteredGames.length === 0 && (
        <div className="px-5 py-2 flex flex-col gap-4">
           {Array.from({ length: 6 }).map((_, i) => (
             <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-7 h-7 bg-foreground/10 rounded" />
                <div className="h-3 bg-foreground/10 rounded w-24" />
             </div>
           ))}
        </div>
      )}

      {/* List Games  */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="flex flex-col gap-1 px-3">
          {filteredGames.map((game) => {
            const slug = formatTitle(game.name);
            const pathForItem = `/library/${slug}/${game.gameId}`;
            const isActive = location.pathname.startsWith(pathForItem);

            return (
              <LibrarySidebarItem
                key={game.gameId}
                entry={{
                  gameId: game.gameId,
                  gameName: game.name,
                  coverVerticalImage: game.coverVerticalImage,
                  bannerImage: game.bannerImage,
                }}
                isActive={isActive}
                onClick={() => navigate(pathForItem)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
