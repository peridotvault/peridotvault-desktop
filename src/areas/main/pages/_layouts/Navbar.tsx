// @ts-ignore
import React from 'react';
import { ButtonWithSound } from '@shared/components/ui/ButtonWithSound';
import { SearchInput } from '@shared/components/organisms/search-input';

export const MainNavbar = () => {
  const chains = [
    {
      name: 'Solana',
      imgUrl: './images/chains/sol.webp',
    },
    {
      name: 'Ethereum',
      imgUrl: './images/chains/eth.webp',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-background shadow-flat-sm py-4">
      <div className="flex w-full px-12 justify-center">
        <div className="flex justify-between items-center max-w-[1400px] gap-5 w-full">
          {/* left ========================================= */}
          <section className="flex gap-5 font-bold text-lg items-center w-80">
            <SearchInput />
          </section>

          {/* Right ========================================= */}
          <section className="flex gap-5 items-center">
            <div className="flex gap-3">
              {chains.map((item, index) => (
                <ButtonWithSound
                  key={index}
                  className="w-11 h-11 shadow-arise-sm rounded-md flex items-center justify-center"
                >
                  <img
                    src={item.imgUrl}
                    alt={item.name + ' Logo'}
                    width={24}
                    className="rounded-full bg-black"
                  />
                </ButtonWithSound>
              ))}
            </div>
          </section>
        </div>
      </div>
    </header>
  );
};
