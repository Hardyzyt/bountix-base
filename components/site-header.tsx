import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut, Menu, User } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ButtonLink } from "@/components/ui/button";
import { logoutAction } from "@/app/auth/actions";
import { createTranslator, type TranslationKey } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/server";
import { getUnreadNotificationCount } from "@/lib/notifications";

type NavLink = {
  href: string;
  labelKey: TranslationKey;
  external?: boolean;
};

const guestNavLinks = [
  { href: "/tasks", labelKey: "common.browseTasks" },
  { href: "/creators", labelKey: "nav.creators" },
  { href: "/about", labelKey: "nav.about" },
] satisfies NavLink[];

const authedNavLinks = [
  { href: "/dashboard", labelKey: "common.dashboard" },
] satisfies NavLink[];

const authedMenuLinks: NavLink[] = [
  { href: "/post-task", labelKey: "common.postTask" },
  { href: "/post-service", labelKey: "common.postService" },
  { href: "/tasks", labelKey: "common.tasks" },
  { href: "/creators", labelKey: "service.creatorServices" },
  { href: "/dashboard/services", labelKey: "service.myServices" },
  { href: "/notifications", labelKey: "common.notifications" },
  { href: "/dashboard/profile", labelKey: "dashboard.nav.profile" },
];

/**
 * Read the current Supabase user without throwing if env vars are missing
 * (public pages must keep rendering even before auth is fully wired).
 */
async function getCurrentUser() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

function getDisplayHandle(
  user: { email?: string | null } | null,
  fallback: string,
) {
  if (!user?.email) return fallback;
  const local = user.email.split("@")[0];
  return local.length > 14 ? `${local.slice(0, 13)}…` : local;
}

export async function SiteHeader() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const user = await getCurrentUser();
  const displayHandle = getDisplayHandle(user, t("common.account"));
  const unreadCount = user ? await getUnreadNotificationCount() : 0;
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const navLinks: NavLink[] = user ? authedNavLinks : guestNavLinks;

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[#140625] bg-[#fffaf4]/95 backdrop-blur-xl">
      <div className="container-page py-3">
        <div className="flex min-h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label="Bountix home"
          >
            <span className="relative h-10 w-10 overflow-hidden rounded-lg border-2 border-[#140625] bg-[#38e7ff] shadow-[4px_4px_0_#140625]">
              <Image
                src="/bountix-comic/bountix_assets_ready/bountix-app-icon.png"
                alt=""
                fill
                sizes="40px"
                className="object-cover"
                priority
              />
            </span>
            <span className="truncate text-lg font-black uppercase text-[#140625]">
              Bountix
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer" : undefined}
                className="rounded-lg px-3 py-2 text-sm font-bold text-[#140625] transition hover:bg-[#38e7ff]"
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher locale={locale} />
            {user ? (
              <details className="relative">
                <summary className="inline-flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-xs font-black uppercase text-[#140625] shadow-[3px_3px_0_#140625] transition hover:-translate-y-0.5 hover:bg-[#38e7ff] [&::-webkit-details-marker]:hidden">
                  <Menu aria-hidden="true" className="h-4 w-4" />
                  Menu
                </summary>
                <div className="absolute right-0 top-full z-50 mt-3 w-64 rounded-lg border-2 border-[#140625] bg-[#fffaf4] p-3 shadow-[7px_7px_0_#140625]">
                  <div className="truncate rounded-lg border-2 border-[#140625] bg-[#f2e6ff] px-3 py-2 text-xs font-black uppercase text-[#140625]">
                    {displayHandle}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {authedMenuLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noreferrer" : undefined}
                        className="flex min-h-10 items-center justify-between gap-2 rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-xs font-black uppercase text-[#140625] shadow-[3px_3px_0_#140625] transition hover:-translate-y-0.5 hover:bg-[#38e7ff]"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          {link.href === "/notifications" ? (
                            <Bell aria-hidden="true" className="h-4 w-4 shrink-0" />
                          ) : null}
                          {link.href === "/dashboard/profile" ? (
                            <User aria-hidden="true" className="h-4 w-4 shrink-0" />
                          ) : null}
                          <span className="truncate">{t(link.labelKey)}</span>
                        </span>
                        {link.href === "/notifications" && unreadCount > 0 ? (
                          <span className="min-w-6 rounded-full border-2 border-[#140625] bg-[#ff4fb8] px-1.5 py-0.5 text-center text-[0.65rem] font-black leading-none text-white">
                            {unreadLabel}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border-2 border-[#140625] bg-[#ffdd3d] px-3 py-2 text-xs font-black uppercase text-[#140625] shadow-[3px_3px_0_#140625] transition hover:-translate-y-0.5 hover:bg-[#ff4fb8] hover:text-white"
                      >
                        <LogOut aria-hidden="true" className="h-4 w-4" />
                        {t("common.logout")}
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-10 items-center rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-xs font-black uppercase text-[#140625] shadow-[3px_3px_0_#140625] transition hover:bg-[#38e7ff]"
                >
                  {t("common.login")}
                </Link>
                <ButtonLink
                  href="/signup"
                  className="min-h-10 px-3 py-2 text-xs sm:px-4 sm:text-sm"
                >
                  {t("common.joinWaitlist")}
                </ButtonLink>
              </>
            )}
          </div>

          <details className="relative lg:hidden">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center justify-center rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-[#140625] shadow-[3px_3px_0_#140625] transition hover:bg-[#38e7ff] [&::-webkit-details-marker]:hidden">
              <Menu aria-hidden="true" className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </summary>
            <div className="absolute right-0 top-full z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-lg border-2 border-[#140625] bg-[#fffaf4] p-3 shadow-[7px_7px_0_#140625]">
              {user ? (
                <div className="truncate rounded-lg border-2 border-[#140625] bg-[#f2e6ff] px-3 py-2 text-xs font-black uppercase text-[#140625]">
                  {displayHandle}
                </div>
              ) : null}
              <div className="mt-3 grid gap-2 first:mt-0">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noreferrer" : undefined}
                    className="rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-sm font-black text-[#140625] shadow-[3px_3px_0_#140625] transition hover:bg-[#38e7ff]"
                  >
                    {t(link.labelKey)}
                  </Link>
                ))}
              </div>
              <div className="mt-3 border-t-2 border-[#140625]/20 pt-3">
                <LanguageSwitcher
                  locale={locale}
                  className="w-full justify-between"
                />
              </div>
              <div className="mt-3 grid gap-2 border-t-2 border-[#140625]/20 pt-3">
                {user ? (
                  <>
                    {authedMenuLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noreferrer" : undefined}
                        className="flex min-h-10 items-center justify-between gap-2 rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-sm font-black text-[#140625] shadow-[3px_3px_0_#140625] transition hover:bg-[#38e7ff]"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          {link.href === "/notifications" ? (
                            <Bell aria-hidden="true" className="h-4 w-4 shrink-0" />
                          ) : null}
                          {link.href === "/dashboard/profile" ? (
                            <User aria-hidden="true" className="h-4 w-4 shrink-0" />
                          ) : null}
                          <span className="truncate">{t(link.labelKey)}</span>
                        </span>
                        {link.href === "/notifications" && unreadCount > 0 ? (
                          <span className="min-w-6 rounded-full border-2 border-[#140625] bg-[#ff4fb8] px-1.5 py-0.5 text-center text-[0.65rem] font-black leading-none text-white">
                            {unreadLabel}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border-2 border-[#140625] bg-[#ffdd3d] px-3 py-2 text-sm font-black text-[#140625] shadow-[3px_3px_0_#140625] transition hover:bg-[#ff4fb8] hover:text-white"
                      >
                        <LogOut aria-hidden="true" className="h-4 w-4" />
                        {t("common.logout")}
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="rounded-lg border-2 border-[#140625] bg-[#ffdd3d] px-3 py-2 text-sm font-black text-[#140625] shadow-[3px_3px_0_#140625] transition hover:bg-[#38e7ff]"
                    >
                      {t("common.joinWaitlist")}
                    </Link>
                    <Link
                      href="/login"
                      className="rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-sm font-black text-[#140625] shadow-[3px_3px_0_#140625] transition hover:bg-[#38e7ff]"
                    >
                      {t("common.login")}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
