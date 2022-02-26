import React from "react";
import MuiImage from "mui-image";

const AsyncImage = (props) => {
    const [loadedSrc, setLoadedSrc] = React.useState(null);
    React.useEffect(() => {
        setLoadedSrc(null);
        if (props.src) {
            const handleLoad = () => {
              setLoadedSrc(props.src);
          };
          const image = new Image();
          image.addEventListener('load', handleLoad);
            image.src = props.src;
          return () => {
                image.removeEventListener('load', handleLoad);
          };
      }
  }, [props.src]);
    if (loadedSrc === props.src) {
      return (


          <MuiImage {...props} style={{
              width: props.sx.width || '100%',
              height: props.sx.height || '100%',
          }}/>
      );
  }
    return null;
};

export default AsyncImage;