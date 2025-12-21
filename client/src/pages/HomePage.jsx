import HeroIcon from "../components/icons/HeroIcon";

export default function HomePage() {
  return (
    <div className="page">
      <div className="container">
        <section className="home-hero">
          <div className="home-hero-left">
            <div className="home-kicker">Attendance Tracker</div>
            <h1 className="home-title">Track event attendance easily.</h1>
            <p className="home-sub">
              Organizers create events. Participants check in.
            </p>
          </div>

          <div className="home-hero-right" aria-hidden="true">
            <div className="home-icon" role="img" aria-label="Placeholder icon">
              <HeroIcon className="home-hero-icon" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
