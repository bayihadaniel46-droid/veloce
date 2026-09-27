import { useState } from "react";

function CreatePost({ onAddPost }) {
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (!content.trim()) return;

    const newPost = {
      id: Date.now(),
      username: "Daniel",
      content: content
    };

    onAddPost(newPost);

    setContent("");
  };

  return (
    <div className="create-post">
      <textarea
        placeholder="Quoi de neuf ?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <button onClick={handleSubmit}>
        Publier
      </button>
    </div>
  );
}

export default CreatePost;