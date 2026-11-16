"use client";

import Link from "next/link";

export default function ProfileMenu() {
 return <div className="profile-menu">
  <Link href="/profile/" className="profile-menu-link">Profile</Link>
 </div>;
}
