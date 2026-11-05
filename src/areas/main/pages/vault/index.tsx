// @ts-ignore
import React, { useEffect, useState } from 'react';
export default function Vault() {
  return (
    <div className="w-full h-full ">
      <iframe
        src="http://localhost:3000?embed=1"
        // src="https://web.peridotvault.com?embed=1"
        className="w-full h-full border-none"
        title="PeridotVault Store"
      />
    </div>
  );
}
