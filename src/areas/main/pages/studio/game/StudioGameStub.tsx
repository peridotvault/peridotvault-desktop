import React from 'react';
import { useParams } from 'react-router-dom';

export const StudioGameStub = () => {
  const { gameId } = useParams();
  return (
    <div className="p-12 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="relative group mb-12">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
        <div className="relative w-24 h-24 rounded-3xl bg-background_primary border border-white/5 flex items-center justify-center shadow-2xl">
          <span className="text-4xl text-primary font-bold">EVM</span>
        </div>
      </div>
      
      <h2 className="text-3xl font-bold mb-4 tracking-tight">Studio Suite Under Migration</h2>
      <p className="text-muted-foreground max-w-lg mx-auto mb-10 leading-relaxed">
        The development suite for <span className="text-foreground font-semibold">"{gameId}"</span> is being re-engineered for the EVM network to provide a more robust and secure publishing pipeline.
      </p>
      
      <div className="bg-card/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 flex gap-8 items-center max-w-sm mx-auto shadow-sm">
        <div className="flex-1 text-left">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Status</p>
          <p className="text-primary font-bold">Migrating to EVM</p>
        </div>
        <div className="h-8 w-[1px] bg-white/10" />
        <div className="flex-1 text-left">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Target</p>
          <p className="font-bold">Base Sepolia</p>
        </div>
      </div>
    </div>
  );
};
