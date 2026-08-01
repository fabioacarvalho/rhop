import { NotificacaoBadge } from "@/components/notificacoes/NotificacaoBadge";
import { NotificacoesPopover } from "@/components/notificacoes/NotificacoesPopover";
import styles from "./NotificationBell.module.css";

/**
 * Wrapper de posicionamento em volta dos componentes ja existentes de
 * `notificacoes` (NAV-12/NAV-13) — nao altera nenhum dos dois arquivos.
 */
export function NotificationBell() {
  return (
    <div className={styles.wrapper}>
      <NotificacoesPopover />
      <NotificacaoBadge />
    </div>
  );
}
