// UpdateProfile.tsx
// @ts-ignore
import React, { ChangeEvent, useEffect, useState } from 'react';
import { useWallet } from '@shared/contexts/WalletContext';
import {
  faEarthAsia,
  faEnvelope,
  faSeedling,
  faTv,
  faUser,
  faVenusMars,
} from '@fortawesome/free-solid-svg-icons';
import countriesData from '@shared/assets/json/countries.json';

import { Gender, UserInterface, UpdateUserInterface } from '@shared/interfaces/user/UserInterface';
import { getIsUsernameValid, getUserData, updateUser } from '@features/profile/services/user';
import { optGet, ToOpt } from '@shared/interfaces/helpers/game.helpers';
import { saveUserInfo } from '@shared/utils/IndexedDb';
import { getCoverImage, getProfileImage } from '@shared/utils/Additional';
import { InputFieldComponent } from '@shared/components/atoms/InputFieldComponent';
import { LoadingScreen } from '@shared/components/organisms/LoadingScreen';
import { DropDownComponent } from '@shared/components/atoms/DropDownComponent';

/** Utils — konversi tanggal (ns <-> YYYY-MM-DD UTC) */
function unixNsToDateStr(ns: bigint): string {
  if (!ns || ns === 0n) return '';
  const ms = Number(ns / 1_000_000n);
  const d = new Date(ms);
  // normalisasi ke midnight UTC supaya cocok <input type="date">
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  return iso;
}
function dateStrToUnixNs(dateStr: string): bigint {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error('Invalid date format (YYYY-MM-DD)');
  const y = Number(m[1]),
    mo = Number(m[2]) - 1,
    d = Number(m[3]);
  const ms = Date.UTC(y, mo, d, 0, 0, 0, 0);
  return BigInt(ms) * 1_000_000n;
}
function genderVariantToCode(g: Gender | null | undefined): 'male' | 'female' | 'other' {
  if (!g) return 'other';
  if ('male' in g) return 'male';
  if ('female' in g) return 'female';
  return 'other';
}
function genderCodeToVariant(code: string): Gender {
  if (code === 'male') return { male: null };
  if (code === 'female') return { female: null };
  return { other: null };
}

/** UI dropdown options */
interface Option {
  code: string;
  name: string;
}
const genderOptions: Option[] = [
  { code: 'male', name: 'Male' },
  { code: 'female', name: 'Female' },
  { code: 'other', name: 'Other' },
];
const countryOptions: Option[] = countriesData as Option[];

/** ===== State form khusus UI (string-friendly) ===== */
type UpdateForm = {
  username: string;
  displayName: string;
  email: string;
  birthDateStr: string; // YYYY-MM-DD
  genderCode: 'male' | 'female' | 'other';
  country: string;
  imageUrl: string | null; // base64/url untuk preview
  backgroundImageUrl: string | null; // base64/url untuk preview
};

export default function EditUser() {
  const { wallet } = useWallet();
  const [updating, setUpdating] = useState(false);

  const [form, setForm] = useState<UpdateForm>({
    username: '',
    displayName: '',
    email: '',
    birthDateStr: '',
    genderCode: 'other',
    country: '',
    imageUrl: null,
    backgroundImageUrl: null,
  });

  const [isValidUsername, setIsValidUsername] = useState({
    valid: true,
    msg: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

  // Load user → map ke form UI
  useEffect(() => {
    (async () => {
      try {
        if (!wallet?.encryptedPrivateKey) return; // ← perbaikan (jangan return saat wallet ada)
        const user: UserInterface = await getUserData({ wallet });
        setForm({
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          birthDateStr: unixNsToDateStr(user.userDemographics.birthDate),
          genderCode: genderVariantToCode(user.userDemographics.gender),
          country: user.userDemographics.country,
          imageUrl: optGet(user.imageUrl) ?? null,
          backgroundImageUrl: optGet(user.backgroundImageUrl) ?? null,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [wallet?.encryptedPrivateKey]);

  // Handlers
  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const onGenderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value as UpdateForm['genderCode'];
    setForm((p) => ({ ...p, genderCode: code }));
  };

  const handleImageUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    field: 'imageUrl' | 'backgroundImageUrl',
  ) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const MAX = 1.5 * 1024 * 1024;
      if (file.size > MAX) {
        alert(`File too large (>1.5MB). Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        e.target.value = '';
        return;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () =>
          typeof r.result === 'string' ? resolve(r.result) : reject(new Error('toBase64 failed'));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      setForm((p) => ({ ...p, [field]: base64 }));
    } catch (err) {
      console.error(err);
      e.target.value = '';
      alert('Failed to upload image.');
    }
  };

  const handleSubmit = async () => {
    // Validasi ringan
    if (!form.username || !form.displayName || !form.email || !form.birthDateStr || !form.country) {
      alert('Please fill in all fields');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      setUpdating(true);
      const payload: UpdateUserInterface = {
        username: form.username,
        displayName: form.displayName,
        email: form.email,
        imageUrl: ToOpt(form.imageUrl ?? undefined),
        backgroundImageUrl: ToOpt(form.backgroundImageUrl ?? undefined),
        userDemographics: {
          birthDate: dateStrToUnixNs(form.birthDateStr),
          gender: genderCodeToVariant(form.genderCode),
          country: form.country,
        },
      };

      const updated = await updateUser({ metadataUpdate: payload, wallet });
      await saveUserInfo(updated as unknown as UserInterface);
      setShowSuccess(true);
    } catch (error) {
      console.error('Error updating account:', error);
      setShowFailed(true);
      setTimeout(() => setShowFailed(false), 2000);
      setShowFailed(true);
      setTimeout(() => setShowFailed(false), 2000);
    } finally {
      setUpdating(false); // ⬅️ selesai loading
      setTimeout(() => setShowSuccess(false), 2000);
    }
  };

  // Username validation while typing
  const onUsernameChange = async (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    try {
      const res = await getIsUsernameValid(e.target.value);
      if ('ok' in res) {
        setIsValidUsername({ valid: true, msg: 'username valid' });
      } else if ('err' in res) {
        const err = res.err as { InvalidInput?: string };
        setIsValidUsername({
          valid: false,
          msg: err.InvalidInput ?? 'Invalid username',
        });
      }
    } catch {
      setIsValidUsername({ valid: false, msg: 'Validation failed' });
    }
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <main className="w-full flex flex-col">
      <div className="flex flex-col items-center w-full">
        {showSuccess && (
          <div className="fixed top-20 right-8 z-50 bg-chart-2 text-white px-6 py-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-right-4 duration-300">
            Account Updated Successfully
          </div>
        )}
        {showFailed && (
          <div className="fixed top-20 right-8 z-50 bg-chart-5 text-white px-6 py-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-right-4 duration-300">
            Account Update Failed
          </div>
        )}

        <div className="mb-3 py-6 px-10 border-b border-muted-foreground flex justify-between items-center w-full">
          <p className="text-2xl font-semibold">Account Settings</p>
          <button
            onClick={handleSubmit}
            className="p-2 px-10 rounded-lg duration-300 bg-accent font-bold"
          >
            Update
          </button>
        </div>

        <div className="container flex gap-10 px-10 pt-3 pb-10">
          {updating && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-background px-6 py-4 rounded-xl shadow-arise-sm flex items-center gap-3">
                <span className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Updating profile…</span>
              </div>
            </div>
          )}

          <div className="w-1/2 flex flex-col gap-10">
            {/* Profile Photo */}
            <div className="flex flex-col gap-3">
              <p className="capitalize font-semibold">Profile Photo</p>
              <div className="flex justify-center">
                <div className="shadow-arise-sm w-[230px] aspect-square rounded-full overflow-hidden">
                  {form.imageUrl && (
                    <img
                      src={getProfileImage(form.imageUrl)}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'imageUrl')}
                className="w-full bg-transparent shadow-sunken-sm px-5 mt-3 py-3 rounded-lg"
              />
            </div>

            {/* Background Image */}
            <div className="flex flex-col gap-3">
              <p className="capitalize font-semibold">Background Image</p>
              <div className="flex justify-center">
                <div className="shadow-arise-sm w-full h-60 rounded-xl overflow-hidden">
                  {form.backgroundImageUrl && (
                    <img
                      src={getCoverImage(form.backgroundImageUrl)}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'backgroundImageUrl')}
                className="w-full bg-transparent shadow-sunken-sm px-5 mt-3 py-3 rounded-lg"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6 w-1/2">
            <div className="flex flex-col gap-2">
              <p className="text-xl font-semibold">User Information</p>
              <p className="text-muted-foreground">
                Here you can edit public information about yourself. The changes will be visible to
                other users.
              </p>
            </div>

            <div>
              <InputFieldComponent
                name="username"
                icon={faUser}
                type="text"
                placeholder="username"
                value={form.username}
                onChange={onUsernameChange}
              />
              <p className={`${isValidUsername.valid ? 'text-chart-2' : 'text-chart-5'}`}>
                {isValidUsername.msg}
              </p>
            </div>

            <InputFieldComponent
              name="displayName"
              icon={faTv}
              type="text"
              placeholder="Display Name"
              value={form.displayName}
              onChange={onChange}
            />

            <InputFieldComponent
              name="email"
              icon={faEnvelope}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={onChange}
            />

            <InputFieldComponent
              name="birthDateStr"
              icon={faSeedling}
              type="date"
              placeholder="Birth Date"
              value={form.birthDateStr}
              onChange={onChange}
            />

            <DropDownComponent
              name="gender"
              icon={faVenusMars}
              placeholder="Gender"
              className=""
              value={form.genderCode}
              options={genderOptions}
              onChange={onGenderChange}
            />

            <DropDownComponent
              name="country"
              icon={faEarthAsia}
              placeholder="Country"
              className=""
              value={form.country}
              options={countryOptions}
              onChange={onChange}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
