import { mobilep } from '../../../constants/hpp';
import { getEnvVariable } from '../../../helpers/helper';
function HppStatic(props: any) {
  const randomNumber = Math.floor(Math.random() * 1000000) + 1;

  if (props.useInline == 'true') {
    return <style type="text/css" dangerouslySetInnerHTML={{ __html: mobilep }}></style>;
  } else {
    if (getEnvVariable('SELF__RUNNING_ENV') == 'dev') {
      return (
        <link
          type="text/css"
          rel="stylesheet"
          href={`https://www.akakce.dev/include/aa/styles/_pcss.v9.asp?minifyrequest=0&mobilelhpp&${randomNumber}`}
        ></link>
      );
    } else if (getEnvVariable('SELF__RUNNING_ENV') == 'test') {
      return (
        <link
          type="text/css"
          rel="stylesheet"
          href={`https://www.bakakce.com/styles/mobilelhpp.css?${randomNumber}`}
        ></link>
      );
    } else {
      return (
        <link
          type="text/css"
          rel="stylesheet"
          href={`https://st.akakce.com/styles/mobilelhpp.css?${randomNumber}`}
        ></link>
      );
    }
  }
}

export default HppStatic;
