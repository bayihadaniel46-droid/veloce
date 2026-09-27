function Stories() {

  const stories = [
    { id: 1, name: "Daniel" },
    { id: 2, name: "Alice" },
    { id: 3, name: "Kevin" },
    { id: 4, name: "Sarah" },
    { id: 5, name: "Paul" }
  ];

  return (
    <div className="stories">

      {stories.map((story) => (
        <div key={story.id} className="story">

          <div className="story-avatar">
            {story.name.charAt(0)}
          </div>

          <span>{story.name}</span>

        </div>
      ))}

    </div>
  );
}

export default Stories;