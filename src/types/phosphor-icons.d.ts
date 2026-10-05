declare module "@phosphor-icons/react" {
  import type { ComponentType, SVGProps } from "react";
  export type IconProps = SVGProps<SVGSVGElement> & { weight?: string; size?: string | number };
  type Icon = ComponentType<IconProps>;
  export const ArrowRight: Icon;
  export const ArrowSquareOut: Icon;
  export const CheckCircle: Icon;
  export const Desktop: Icon;
  export const FileArrowUp: Icon;
  export const GlobeHemisphereWest: Icon;
  export const Info: Icon;
  export const LinkBreak: Icon;
  export const List: Icon;
  export const Moon: Icon;
  export const SpinnerGap: Icon;
  export const Sun: Icon;
  export const Wallet: Icon;
  export const WarningCircle: Icon;
  export const X: Icon;
}

declare module "@phosphor-icons/react/dist/ssr" {
  import type { ComponentType, SVGProps } from "react";
  type Icon = ComponentType<SVGProps<SVGSVGElement> & { weight?: string; size?: string | number }>;
  export const ArrowLeft: Icon;
  export const ArrowRight: Icon;
  export const CalendarCheck: Icon;
  export const CalendarPlus: Icon;
  export const CaretDown: Icon;
  export const Check: Icon;
  export const CheckCircle: Icon;
  export const ClipboardText: Icon;
  export const Clock: Icon;
  export const CreditCard: Icon;
  export const CurrencyCircleDollar: Icon;
  export const Flask: Icon;
  export const Gear: Icon;
  export const Headset: Icon;
  export const LockKey: Icon;
  export const LockSimple: Icon;
  export const MapPin: Icon;
  export const Plus: Icon;
  export const SignOut: Icon;
  export const UserCircle: Icon;
  export const UsersThree: Icon;
  export const WarningCircle: Icon;
  export const Wrench: Icon;
}
