import Image from "next/image";
import { getAuthUserFromCookies } from "@/lib/db-auth";

export default async function HelloWidget() {
  const auth = await getAuthUserFromCookies();
  const doctorName = auth?.name ?? "Doctor";

  return (
    <div className="relative min-h-36 overflow-hidden rounded-xl bg-[#167980] p-6">
      <h2 className="text-2xl text-white">
        Welcome, <span className="font-bold">{doctorName}</span>
      </h2>
      <p className="mt-1 max-w-sm text-sm text-white/80">Your appointments and report reviews are ready.</p>

      <Image
        src="/doctor.svg"
        alt="doctor illustration"
        width={180}
        height={180}
        className="absolute bottom-0 right-8 hidden h-40 w-40 md:block"
      />
    </div>
  );
}
