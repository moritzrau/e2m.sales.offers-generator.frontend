interface Props {
  title: string;
  text: string;
}

export function PlaceholderPage({ title, text }: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <h2>{title}</h2>
          <p>In Arbeit</p>
        </div>
      </div>
      <div className="card">
        <p className="muted">{text}</p>
      </div>
    </>
  );
}
