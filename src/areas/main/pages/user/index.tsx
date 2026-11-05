// @ts-ignore
import React, { useEffect, useState } from 'react';
import { useWallet } from '@shared/contexts/WalletContext';
import { UserInterface } from '@shared/interfaces/user/UserInterface';
import { getUserData } from '@features/profile/services/user';
import { optGet, optGetOr } from '@shared/interfaces/helpers/game.helpers';
import { getProfileImage } from '@shared/utils/Additional';
import { ImageLoading } from '@shared/constants/images';
import { LoadingScreen } from '@shared/components/organisms/LoadingScreen';

export default function ProfileUser() {
  const { wallet } = useWallet();
  const [userData, setUserData] = useState<UserInterface | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let timer: number | undefined;

    const load = async () => {
      try {
        if (!wallet?.encryptedPrivateKey) {
          setIsLoading(false);
          return;
        }
        const user = await getUserData({ wallet });
        setUserData(user ?? null);
      } catch (e) {
        console.error('getUserData failed:', e);
      } finally {
        setIsLoading(false);
      }
    };

    // initial fetch
    load();

    // optional: polling tiap 5 detik (hapus kalau tak perlu)
    timer = window.setInterval(load, 5000);

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [wallet]);

  // Bentuk Option aman untuk helper ([] | [T])
  const bgOpt = userData?.backgroundImageUrl ?? [];
  const imgOpt = userData?.imageUrl ?? [];

  return (
    <main className="flex flex-col items-center mb-10 px-10">
      {isLoading && <LoadingScreen />}

      <div className="container flex gap-6 mt-6 duration-300">
        {/* left */}
        <div className="w-full flex flex-col gap-6 duration-300 transition-all">
          <section className="p-6 bg-background rounded-3xl shadow-arise-sm">
            {/* cover */}
            <div className="w-full h-44">
              <img
                src={optGetOr(bgOpt, ImageLoading)}
                className="w-full h-60 object-cover rounded-2xl"
                alt="cover"
              />
            </div>

            {/* profile */}
            <div className="px-10 relative flex items-end gap-6 justify-between">
              <div className="w-36 h-36 bg-background shadow-2xl rounded-full z-10 overflow-hidden p-2">
                <img
                  src={getProfileImage(optGet(imgOpt))}
                  className="w-full h-full object-cover rounded-full"
                  alt="avatar"
                />
              </div>
            </div>

            {/* bio */}
            <div className="flex flex-col gap-3 mt-3 px-10">
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <p className="font-medium text-2xl">{userData?.displayName ?? '—'}</p>
                </div>
                <p className="text-muted-foreground text-lg">@{userData?.username ?? ''}</p>
              </div>
            </div>
          </section>
        </div>

        {/* right */}
        <div className="w-2/5 max-w-[350px] flex flex-col gap-6 duration-300 transition-all">
          <section className="aspect-3/4 rounded-3xl overflow-hidden shadow-flat-sm">
            {/* https://i.imgur.com/PL9cXAX.gif */}
            <img
              src="https://i.pinimg.com/736x/e0/c1/11/e0c1114baf11244075041ea00cfca531.jpg"
              className="w-full h-full object-cover"
              alt=""
            />
          </section>
        </div>
      </div>
    </main>
  );
}
