import { Bell } from "@phosphor-icons/react/dist/ssr/Bell";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { openNotification } from "@/app/workspace/notifications/actions";
import { CloseIcon } from "@/components/icons/close-icon";
import { DismissibleDetails } from "@/components/ui/dismissible-details";

type Notification = { id: number; title: string; body: string; href: string | null; read_at: string | null; created_at: string };

export function NotificationMenu({ notifications }: { notifications: Notification[] }) {
  const unread = notifications.filter((item) => !item.read_at).length;
  return <DismissibleDetails className="notification-menu" mobileModal><summary aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}><Bell /><span className="sr-only">Notifications</span>{unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}</summary><div className="notification-panel glass-panel" data-sheet-panel role="dialog" aria-label="Notifications"><button className="sheet-close" type="button" data-close-details><CloseIcon /> Close</button><div className="compact-section-heading"><div><p className="kicker">Notifications</p><h2>What needs attention</h2></div><Bell /></div>{notifications.length ? <ol>{notifications.map((item) => <li key={item.id} className={item.read_at ? "" : "unread"}><div><strong>{item.title}</strong>{item.read_at && <CheckCircle aria-label="Read" />}</div><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small><form action={openNotification}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="href" value={item.href ?? "/workspace"} /><button className="button button-quiet" type="submit">Open</button></form></li>)}</ol> : <p className="empty-inline">No notifications yet. Message, support, replacement, and agreement updates will appear here.</p>}</div></DismissibleDetails>;
}
