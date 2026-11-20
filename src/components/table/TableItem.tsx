import type { JSX } from "@solidjs/web";
import "./TableItem.css";

export interface TableItemProps {
  children: JSX.Element;
}

export default function TableItem(props: TableItemProps) {
  return <tr class="table-item">{props.children}</tr>;
}

