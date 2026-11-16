const CLASSES = { IDOSO: 'badge-idoso', PRIORIDADE: 'badge-prio' };

export default function Badge({ category, label, style }) {
    return (
        <span className={`badge ${CLASSES[category] || 'badge-normal'}`} style={style}>
            {label || category}
        </span>
    );
}
