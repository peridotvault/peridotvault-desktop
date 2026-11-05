import React from 'react';
import { NewGame } from '@features/game/components/new-game.modal';

export default function StudioGames() {
  return (
    <div className="p-8">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Studio Games</h1>
        <NewGame />
      </header>
      
      <div className="relative group overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background_primary to-background_secondary p-1 border border-white/5">
        <div className="bg-background_primary/80 backdrop-blur-3xl p-16 rounded-[2.25rem] text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-6 group-hover:scale-110 transition-transform duration-500">
             <span className="text-3xl text-primary font-bold">P</span>
          </div>
          <p className="text-2xl font-medium mb-3">Your studio games will appear here.</p>
          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
            We are currently migrating the studio and publishing features to the EVM network to provide a better cross-chain developer experience.
          </p>
        </div>
      </div>
    </div>
  );
}
